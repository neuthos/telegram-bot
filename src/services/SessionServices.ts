import {Database} from "../config/database";
import {Logger} from "../config/logger";
import {UserSession, RegisteredUser, FormData, SessionStep} from "../types";

export class SessionService {
  private db = Database.getInstance();
  private logger = Logger.getInstance();

  public async getActiveSession(
    telegramId: number
  ): Promise<UserSession | null> {
    try {
      const result = await this.db.query(
        "SELECT * FROM active_sessions WHERE telegram_id = $1",
        [telegramId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        ...row,
        form_data: row.form_data || {},
      };
    } catch (error) {
      this.logger.error("Error getting active session:", {telegramId, error});
      throw error;
    }
  }

  public async createOrUpdateSession(
    session: Partial<UserSession>
  ): Promise<UserSession> {
    try {
      const existingSession = await this.getActiveSession(session.telegram_id!);

      if (existingSession) {
        const result = await this.db.query(
          `UPDATE active_sessions 
                     SET current_step = $1, form_data = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE telegram_id = $3 
                     RETURNING *`,
          [
            session.current_step,
            JSON.stringify(session.form_data),
            session.telegram_id,
          ]
        );
        return {...result.rows[0], form_data: result.rows[0].form_data || {}};
      } else {
        const result = await this.db.query(
          `INSERT INTO active_sessions (telegram_id, username, first_name, last_name, current_step, form_data)
                     VALUES ($1, $2, $3, $4, $5, $6) 
                     RETURNING *`,
          [
            session.telegram_id,
            session.username,
            session.first_name,
            session.last_name,
            session.current_step || SessionStep.MENU,
            JSON.stringify(session.form_data || {}),
          ]
        );
        return {...result.rows[0], form_data: result.rows[0].form_data || {}};
      }
    } catch (error) {
      this.logger.error("Error creating/updating session:", {session, error});
      throw error;
    }
  }

  public async getRegisteredUser(
    telegramId: number
  ): Promise<RegisteredUser | null> {
    try {
      const result = await this.db.query(
        "SELECT * FROM registered_sessions WHERE telegram_id = $1",
        [telegramId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.logger.error("Error getting registered user:", {telegramId, error});
      throw error;
    }
  }

  public async isKtpRegistered(ktpNumber: string): Promise<boolean> {
    try {
      const activeResult = await this.db.query(
        "SELECT 1 FROM active_sessions WHERE form_data->>'nomor_ktp' = $1",
        [ktpNumber]
      );

      const registeredResult = await this.db.query(
        "SELECT 1 FROM registered_sessions WHERE nomor_ktp = $1",
        [ktpNumber]
      );

      return activeResult.rows.length > 0 || registeredResult.rows.length > 0;
    } catch (error) {
      this.logger.error("Error checking KTP registration:", {ktpNumber, error});
      throw error;
    }
  }

  public async completeRegistration(session: UserSession): Promise<void> {
    const client = this.db.getPool();
    const dbClient = await client.connect();

    try {
      await dbClient.query("BEGIN");

      // Insert to registered_sessions
      await dbClient.query(
        `INSERT INTO registered_sessions 
                 (telegram_id, username, first_name, last_name, nama, nomor_telepon, nomor_ktp, alamat, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')`,
        [
          session.telegram_id,
          session.username,
          session.first_name,
          session.last_name,
          session.form_data.nama,
          session.form_data.nomor_telepon,
          session.form_data.nomor_ktp,
          session.form_data.alamat,
        ]
      );

      // Delete from active_sessions
      await dbClient.query(
        "DELETE FROM active_sessions WHERE telegram_id = $1",
        [session.telegram_id]
      );

      await dbClient.query("COMMIT");

      this.logger.info("Registration completed successfully:", {
        telegramId: session.telegram_id,
        ktpNumber: session.form_data.nomor_ktp,
      });
    } catch (error) {
      await dbClient.query("ROLLBACK");
      this.logger.error("Error completing registration:", {session, error});
      throw error;
    } finally {
      dbClient.release();
    }
  }

  public async isUserRegistered(telegramId: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        "SELECT 1 FROM registered_sessions WHERE telegram_id = $1",
        [telegramId]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error("Error checking user registration:", {
        telegramId,
        error,
      });
      throw error;
    }
  }

  public async resetSession(telegramId: number): Promise<void> {
    try {
      await this.db.query(
        "DELETE FROM active_sessions WHERE telegram_id = $1",
        [telegramId]
      );
      this.logger.info("Session reset:", {telegramId});
    } catch (error) {
      this.logger.error("Error resetting session:", {telegramId, error});
      throw error;
    }
  }

  public async getNextStep(formData: FormData): Promise<SessionStep> {
    if (!formData.nama) return SessionStep.NAMA;
    if (!formData.nomor_telepon) return SessionStep.NOMOR_TELEPON;
    if (!formData.nomor_ktp) return SessionStep.NOMOR_KTP;
    if (!formData.alamat) return SessionStep.ALAMAT;
    return SessionStep.CONFIRMATION;
  }
}
