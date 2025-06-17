import {Pool} from "pg";
import {Database} from "../config/database";
import {Logger} from "../config/logger";
import {
  UserSession,
  KYCApplication,
  KYCPhoto,
  FormData,
  SessionStep,
  KYCListResponse,
} from "../types";
import {CacheFactory} from "./cache/CacheFactory";
import {CacheProvider} from "./cache/CacheProvider";

export class SessionService {
  private db: Pool;
  private cache: CacheProvider;
  private logger = Logger.getInstance();

  constructor() {
    this.db = Database.getInstance().getPool();
    this.cache = CacheFactory.create();
  }

  async getActiveSession(
    partnerId: number,
    telegramId: number
  ): Promise<UserSession | null> {
    const cacheKey = `session:${partnerId}:${telegramId}`;
    const cached = await this.cache.get<UserSession>(cacheKey);

    if (cached) return cached;

    const result = await this.db.query(
      `SELECT * FROM active_sessions 
      WHERE partner_id = $1 AND telegram_id = $2`,
      [partnerId, telegramId]
    );

    if (result.rows.length === 0) return null;

    const session = {
      ...result.rows[0],
      form_data: result.rows[0].form_data || {},
    };

    await this.cache.set(cacheKey, session, 300);
    return session;
  }

  async createOrUpdateSession(session: UserSession): Promise<UserSession> {
    const lockKey = `lock:session:${session.partner_id}:${session.telegram_id}`;
    const acquired = await this.cache.acquireLock(lockKey, 30);

    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.createOrUpdateSession(session);
    }

    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id FROM active_sessions 
        WHERE partner_id = $1 AND telegram_id = $2 
        FOR UPDATE`,
        [session.partner_id, session.telegram_id]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await client.query(
          `UPDATE active_sessions 
          SET current_step = $1, form_data = $2, updated_at = CURRENT_TIMESTAMP
          WHERE partner_id = $3 AND telegram_id = $4
          RETURNING *`,
          [
            session.current_step,
            JSON.stringify(session.form_data),
            session.partner_id,
            session.telegram_id,
          ]
        );
      } else {
        result = await client.query(
          `INSERT INTO active_sessions 
          (partner_id, telegram_id, username, first_name, last_name, current_step, form_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            session.partner_id,
            session.telegram_id,
            session.username,
            session.first_name,
            session.last_name,
            session.current_step || SessionStep.MENU,
            JSON.stringify(session.form_data || {}),
          ]
        );
      }

      await client.query("COMMIT");

      const updatedSession = {
        ...result.rows[0],
        form_data: result.rows[0].form_data || {},
      };

      await this.cache.set(
        `session:${session.partner_id}:${session.telegram_id}`,
        updatedSession,
        300
      );

      return updatedSession;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      await this.cache.releaseLock(lockKey);
    }
  }

  async isIdCardRegistered(
    partnerId: number,
    idCardNumber: string
  ): Promise<boolean> {
    const cacheKey = `idcard:${partnerId}:${idCardNumber}`;
    const cached = await this.cache.get<boolean>(cacheKey);

    if (cached !== null) return cached;

    const [activeResult, registeredResult] = await Promise.all([
      this.db.query(
        `SELECT 1 FROM active_sessions 
        WHERE partner_id = $1 AND form_data->>'id_card_number' = $2`,
        [partnerId, idCardNumber]
      ),
      this.db.query(
        `SELECT 1 FROM kyc_applications 
        WHERE partner_id = $1 AND id_card_number = $2`,
        [partnerId, idCardNumber]
      ),
    ]);

    const exists =
      activeResult.rows.length > 0 || registeredResult.rows.length > 0;
    await this.cache.set(cacheKey, exists, 3600);

    return exists;
  }

  async completeRegistration(session: UserSession): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      const applicationResult = await client.query(
        `INSERT INTO kyc_applications (
         partner_id, telegram_id, username, first_name, last_name,
         agent_name, agent_address, owner_name, business_field,
         pic_name, pic_phone, id_card_number, tax_number,
         account_holder_name, bank_name, account_number,
         signature_initial, province_code, province_name,
         city_code, city_name, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id`,
        [
          session.partner_id,
          session.telegram_id,
          session.username,
          session.first_name,
          session.last_name,
          session.form_data.agent_name,
          session.form_data.agent_address,
          session.form_data.owner_name,
          session.form_data.business_field,
          session.form_data.pic_name,
          session.form_data.pic_phone,
          session.form_data.id_card_number,
          session.form_data.tax_number,
          session.form_data.account_holder_name,
          session.form_data.bank_name,
          session.form_data.account_number,
          session.form_data.signature_initial,
          session.form_data.province_code,
          session.form_data.province_name,
          session.form_data.city_code,
          session.form_data.city_name,
          "draft",
        ]
      );

      const applicationId = applicationResult.rows[0].id;

      const photos = this.preparePhotos(applicationId, session);

      for (const photo of photos) {
        await client.query(
          `INSERT INTO kyc_photos 
          (partner_id, application_id, photo_type, file_url, file_name)
          VALUES ($1, $2, $3, $4, $5)`,
          [
            session.partner_id,
            photo.application_id,
            photo.photo_type,
            photo.file_url,
            photo.file_name,
          ]
        );
      }

      await client.query(
        "DELETE FROM active_sessions WHERE partner_id = $1 AND telegram_id = $2",
        [session.partner_id, session.telegram_id]
      );

      await client.query("COMMIT");

      await this.cache.delete(
        `session:${session.partner_id}:${session.telegram_id}`
      );
      await this.cache.delete(
        `idcard:${session.partner_id}:${session.form_data.id_card_number}`
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private preparePhotos(applicationId: number, session: UserSession): any[] {
    const photos = [];

    if (session.form_data.location_photos?.length) {
      for (const photo of session.form_data.location_photos) {
        photos.push({
          application_id: applicationId,
          photo_type: "location_photos",
          file_url: photo,
          file_name: photo.split("/").pop() || "",
        });
      }
    }

    if (session.form_data.bank_book_photo) {
      photos.push({
        application_id: applicationId,
        photo_type: "bank_book",
        file_url: session.form_data.bank_book_photo,
        file_name: session.form_data.bank_book_photo.split("/").pop() || "",
      });
    }

    if (session.form_data.id_card_photo) {
      photos.push({
        application_id: applicationId,
        photo_type: "id_card",
        file_url: session.form_data.id_card_photo,
        file_name: session.form_data.id_card_photo.split("/").pop() || "",
      });
    }

    return photos;
  }

  async resetSession(partnerId: number, telegramId: number): Promise<void> {
    const lockKey = `lock:session:${partnerId}:${telegramId}`;
    const acquired = await this.cache.acquireLock(lockKey, 10);

    if (!acquired) return;

    try {
      await this.db.query(
        "DELETE FROM active_sessions WHERE partner_id = $1 AND telegram_id = $2",
        [partnerId, telegramId]
      );

      await this.cache.delete(`session:${partnerId}:${telegramId}`);
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  public async getNextStep(formData: FormData): Promise<SessionStep> {
    if (!formData.agent_name) return SessionStep.AGENT_NAME;
    if (!formData.province_code) return SessionStep.PROVINCE_SELECTION;
    if (!formData.city_code) return SessionStep.CITY_SELECTION;
    if (!formData.agent_address) return SessionStep.AGENT_ADDRESS;
    if (!formData.owner_name) return SessionStep.OWNER_NAME;
    if (!formData.business_field) return SessionStep.BUSINESS_FIELD;
    if (!formData.pic_name) return SessionStep.PIC_NAME;
    if (!formData.pic_phone) return SessionStep.PIC_PHONE;
    if (!formData.id_card_number) return SessionStep.ID_CARD_NUMBER;
    if (formData.tax_number === undefined) return SessionStep.TAX_NUMBER;
    if (!formData.account_holder_name) return SessionStep.ACCOUNT_HOLDER_NAME;
    if (!formData.bank_name) return SessionStep.BANK_NAME;
    if (!formData.account_number) return SessionStep.ACCOUNT_NUMBER;
    if (!formData.signature_initial) return SessionStep.SIGNATURE_INITIAL;
    if (!formData.location_photos || formData.location_photos.length === 0)
      return SessionStep.LOCATION_PHOTOS;
    if (!formData.bank_book_photo) return SessionStep.BANK_BOOK_PHOTO;
    if (!formData.id_card_photo) return SessionStep.ID_CARD_PHOTO;
    if (formData.terms_accepted === undefined)
      return SessionStep.TERMS_CONDITIONS;
    return SessionStep.CONFIRMATION;
  }

  public async getApplicationPhotos(
    applicationId: number
  ): Promise<KYCPhoto[]> {
    try {
      const result = await this.db.query(
        "SELECT * FROM kyc_photos WHERE application_id = $1 ORDER BY photo_type, uploaded_at",
        [applicationId]
      );

      return result.rows;
    } catch (error) {
      this.logger.error("Error getting application photos:", {
        applicationId,
        error,
      });
      throw error;
    }
  }

  public async getAllKYCApplications(): Promise<KYCListResponse[]> {
    try {
      const result = await this.db.query(`
    SELECT *, is_processed, province_name, city_name
    FROM kyc_applications 
    ORDER BY created_at DESC
  `);

      return result.rows as KYCListResponse[];
    } catch (error) {
      this.logger.error("Error getting all KYC applications:", error);
      throw error;
    }
  }

  public async getKYCApplicationById(
    id: number
  ): Promise<KYCApplication | null> {
    try {
      const result = await this.db.query(
        `
      SELECT * FROM kyc_applications WHERE id = $1
    `,
        [id]
      );

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as KYCApplication;
    } catch (error) {
      this.logger.error("Error getting KYC application by ID:", error);
      throw error;
    }
  }

  public async updateApplicationStatus(
    id: number,
    status: "confirmed" | "rejected",
    pdfUrl?: string
  ): Promise<void> {
    try {
      const query = pdfUrl
        ? `UPDATE kyc_applications 
           SET status = $1, pdf_url = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`
        : `UPDATE kyc_applications 
           SET status = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`;

      const params = pdfUrl ? [status, pdfUrl, id] : [status, id];

      await this.db.query(query, params);

      this.logger.info("Application status updated:", {
        id,
        status,
        pdfUrl: pdfUrl || "none",
      });
    } catch (error) {
      this.logger.error("Error updating application status:", {
        id,
        status,
        error,
      });
      throw error;
    }
  }

  public async rejectApplication(
    id: number,
    remark: string,
    rejectedByName: string,
    rejectedByInitial: string,
    rejectedByPartner: string
  ): Promise<void> {
    try {
      await this.db.query(
        `UPDATE kyc_applications 
       SET status = 'rejected', remark = $1, confirmed_by_name = $2, 
           confirmed_by_initial = $3, confirmed_by_partner = $4, 
           admin_rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5`,
        [remark, rejectedByName, rejectedByInitial, rejectedByPartner, id]
      );

      this.logger.info("Application rejected:", {id, remark, rejectedByName});
    } catch (error) {
      this.logger.error("Error rejecting application:", {id, remark, error});
      throw error;
    }
  }

  public async getKYCApplication(
    telegramId: number
  ): Promise<KYCApplication | null> {
    try {
      const result = await this.db.query(
        "SELECT * FROM kyc_applications WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 1",
        [telegramId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error("Error getting KYC application:", {telegramId, error});
      throw error;
    }
  }

  public async canUserRegister(
    telegramId: number
  ): Promise<{canRegister: boolean; reason?: string; remark?: string}> {
    try {
      const result = await this.db.query(
        "SELECT status, remark FROM kyc_applications WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 1",
        [telegramId]
      );

      if (result.rows.length === 0) {
        return {canRegister: true};
      }

      const application = result.rows[0];

      if (application.status === "rejected") {
        return {
          canRegister: true,
          reason: "previous_rejected",
          remark: application.remark,
        };
      }

      if (
        application.status === "confirmed" ||
        application.status === "draft"
      ) {
        return {
          canRegister: false,
          reason: `already_${application.status}`,
        };
      }

      return {canRegister: true};
    } catch (error) {
      this.logger.error("Error checking user registration eligibility:", {
        telegramId,
        error,
      });
      throw error;
    }
  }

  public async updateApplicationPdfUrl(
    id: number,
    pdfUrl: string
  ): Promise<void> {
    try {
      await this.db.query(
        `UPDATE kyc_applications 
       SET pdf_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
        [pdfUrl, id]
      );

      this.logger.info("Application PDF URL updated:", {id, pdfUrl});
    } catch (error) {
      this.logger.error("Error updating application PDF URL:", {
        id,
        pdfUrl,
        error,
      });
      throw error;
    }
  }

  public async updateEmeteraiStatus(id: number, status: string): Promise<void> {
    await this.db.query(
      "UPDATE kyc_applications SET emeterai_status = $1 WHERE id = $2",
      [status, id]
    );
  }

  public async updateEmeteraiToken(
    id: number,
    token: string,
    expires: Date
  ): Promise<void> {
    await this.db.query(
      "UPDATE kyc_applications SET emeterai_token = $1, emeterai_token_expires = $2 WHERE id = $3",
      [token, expires, id]
    );
  }

  public async updateEmeteraiTransactionId(
    id: number,
    transactionId: string
  ): Promise<void> {
    await this.db.query(
      "UPDATE kyc_applications SET emeterai_transaction_id = $1 WHERE id = $2",
      [transactionId, id]
    );
  }

  public async updateEmeteraiSN(id: number, sn: string): Promise<void> {
    await this.db.query(
      "UPDATE kyc_applications SET emeterai_sn = $1 WHERE id = $2",
      [sn, id]
    );
  }

  public async updateStampedInfo(
    id: number,
    pdfUrl: string,
    stampedBy: string
  ): Promise<void> {
    await this.db.query(
      "UPDATE kyc_applications SET stamped_pdf_url = $1, stamped_by = $2, stamped_at = NOW() WHERE id = $3",
      [pdfUrl, stampedBy, id]
    );
  }

  public async updateApplicationStatusWithAdmin(
    id: number,
    status: "confirmed" | "rejected",
    confirmedByName: string,
    confirmedByInitial: string,
    confirmedByPartner: string
  ): Promise<void> {
    try {
      if (status === "confirmed") {
        await this.db.query(
          `UPDATE kyc_applications 
         SET status = $1, confirmed_by_name = $2, confirmed_by_initial = $3, 
             confirmed_by_partner = $4, admin_confirmed_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5`,
          [status, confirmedByName, confirmedByInitial, confirmedByPartner, id]
        );
      } else {
        throw new Error("Use rejectApplication method for rejection");
      }

      this.logger.info("Application confirmed with admin info:", {
        id,
        status,
        confirmedByName,
        confirmedByInitial,
        confirmedByPartner,
      });
    } catch (error) {
      this.logger.error("Error updating application status with admin info:", {
        id,
        status,
        error,
      });
      throw error;
    }
  }

  public async updateEmeteraiConsent(
    id: number,
    consent: boolean
  ): Promise<void> {
    try {
      await this.db.query(
        "UPDATE kyc_applications SET user_emeterai_consent = $1 WHERE id = $2",
        [consent, id]
      );
    } catch (error) {
      this.logger.error("Error updating e-meterai consent:", {
        id,
        consent,
        error,
      });
      throw error;
    }
  }

  public async getKYCApplicationByTelegramId(
    telegramId: number
  ): Promise<KYCApplication | null> {
    try {
      const result = await this.db.query(
        "SELECT * FROM kyc_applications WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 1",
        [telegramId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error("Error getting KYC application by telegram ID:", {
        telegramId,
        error,
      });
      throw error;
    }
  }

  public async updateProcessedStatus(
    id: number,
    isProcessed: boolean
  ): Promise<void> {
    try {
      await this.db.query(
        `UPDATE kyc_applications 
       SET is_processed = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
        [isProcessed, id]
      );

      this.logger.info("Application processed status updated:", {
        id,
        isProcessed,
      });
    } catch (error) {
      this.logger.error("Error updating processed status:", {
        id,
        isProcessed,
        error,
      });
      throw error;
    }
  }
}
