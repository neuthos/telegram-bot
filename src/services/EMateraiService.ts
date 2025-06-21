import axios, {AxiosInstance} from "axios";
import FormData from "form-data";
import crypto from "crypto";
import {Logger} from "../config/logger";
import {SessionService} from "./SessionServices";
import {CDNService} from "./CDNService";
import {Database} from "../config/database";
import {TokenManager} from "./TokenManager";

export class EmeteraiService {
  private logger = Logger.getInstance();
  private sessionService = new SessionService();
  private cdnService = new CDNService();
  private tokenManager = TokenManager.getInstance();
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.EMETERAI_BASE_URL,
      timeout: 30000,
      headers: {
        "x-api-key": process.env.EMETERAI_API_KEY,
      },
    });
  }

  public async processStamping(
    applicationId: number,
    stampedBy: string,
    partnerId: number
  ): Promise<void> {
    try {
      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "getting_token"
      );

      const token = await this.tokenManager.getEmeteraiToken(partnerId);

      const application = await this.sessionService.getKYCApplicationById(
        applicationId,
        partnerId
      );

      if (!application?.pdf_url) {
        throw new Error("PDF not found");
      }

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "uploading_document"
      );

      const transactionId = await this.retryOperation(() =>
        this.uploadDocument(applicationId, stampedBy, token, partnerId)
      );

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "generating_sn"
      );

      const snMeterai = await this.retryOperation(() =>
        this.generateSN(applicationId, transactionId, partnerId)
      );

      await this.sessionService.updateEmeteraiStatus(applicationId, "stamping");

      await this.retryOperation(() =>
        this.stampDocument(transactionId, snMeterai, partnerId)
      );

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "downloading"
      );

      const stampedPdfUrl = await this.retryOperation(() =>
        this.downloadStampedDocument(applicationId, transactionId, partnerId)
      );

      await this.sessionService.updateStampedInfo(
        applicationId,
        stampedPdfUrl,
        stampedBy
      );

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "completed"
      );
    } catch (error) {
      await this.sessionService.updateEmeteraiStatus(applicationId, "failed");
      this.logger.error("E-meterai processing failed:", {
        applicationId,
        partnerId,
        error,
      });
      throw error;
    }
  }

  public async pdfConvert(
    applicationId: number,
    pdfBuffer: any,
    partnerId: number
  ): Promise<any> {
    const token = await this.tokenManager.getEmeteraiToken(partnerId);

    const formData = new FormData();
    formData.append("document", pdfBuffer, `kyc_${applicationId}.pdf`);

    const response = await this.axiosInstance.post(
      "/api/v1/pdf-file/document/convert",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: token,
        },
        responseType: "arraybuffer",
      }
    );

    const convertedBuffer = Buffer.from(response.data);

    if (!convertedBuffer.toString("ascii", 0, 4).startsWith("%PDF")) {
      console.error(
        "Invalid PDF header:",
        convertedBuffer.toString("hex", 0, 20)
      );
      throw new Error("Converted data is not a valid PDF");
    }

    return convertedBuffer;
  }

  private async getValidToken(partnerId: number): Promise<string> {
    return await this.tokenManager.getEmeteraiToken(partnerId);
  }

  private async getPartnerConfig(partnerId: number) {
    const db = Database.getInstance().getPool();
    const result = await db.query(
      `SELECT emeterai_client_id, emeterai_client_email 
       FROM partners WHERE id = $1`,
      [partnerId]
    );

    if (result.rows.length === 0) {
      throw new Error("Partner not found");
    }

    return result.rows[0];
  }

  private async uploadDocument(
    applicationId: number,
    stampedBy: string,
    token: string,
    partnerId: number
  ): Promise<string> {
    const partner = await this.getPartnerConfig(partnerId);
    const application = await this.sessionService.getKYCApplicationById(
      applicationId,
      partnerId
    );

    const pdfResponse = await axios.get(application!.pdf_url!, {
      responseType: "arraybuffer",
    });

    const pdfBuffer = Buffer.from(pdfResponse.data);
    const formData = new FormData();

    formData.append("client_id", partner.emeterai_client_id);
    formData.append("email_uploader", partner.emeterai_client_email);
    formData.append("doc_number", `KYC${applicationId}_${Date.now()}`);
    formData.append("doc_date", new Date().toISOString().split("T")[0]);
    formData.append("doc_upload", pdfBuffer, `kyc_${applicationId}.pdf`);
    formData.append("email_stamper", partner.emeterai_client_email);
    formData.append("name_stamper", stampedBy);
    formData.append("ktp_stamper", "");
    formData.append("doc_meterai_location", "Jakarta");
    formData.append("doc_meterai_reason", `KYC Application ${applicationId}`);
    formData.append("jenis_doc_meterai", "Surat Berharga");
    formData.append("jenis_identitas", "");
    formData.append("document_pwd", "");

    const response = await this.axiosInstance.post(
      "/api/v1/emeterai/upload-document-onpremis",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: token,
        },
      }
    );

    const transactionId = response.data.data.transaction_id;
    await this.sessionService.updateEmeteraiTransactionId(
      applicationId,
      transactionId
    );

    return transactionId;
  }

  private async generateSN(
    applicationId: number,
    transactionId: string,
    partnerId: number
  ): Promise<string> {
    const token = await this.tokenManager.getEmeteraiToken(partnerId);
    const partner = await this.getPartnerConfig(partnerId);

    const rulesXReqSignature = `${partner.emeterai_client_id}${transactionId}`;
    const signatureKey = crypto
      .createHash("sha256")
      .update(rulesXReqSignature)
      .digest("hex");

    const response = await this.axiosInstance.post(
      "/api/v1/emeterai/generate-meterai-onpremis-single",
      {
        client_id: partner.emeterai_client_id,
        transaction_id: transactionId,
        meterai_price: "10000",
        signature_key: signatureKey,
      },
      {
        headers: {Authorization: token},
      }
    );

    const snMeterai = response.data.data.sn_meterai;
    await this.sessionService.updateEmeteraiSN(applicationId, snMeterai);
    return snMeterai;
  }

  private async stampDocument(
    transactionId: string,
    snMeterai: string,
    partnerId: number
  ): Promise<void> {
    const token = await this.tokenManager.getEmeteraiToken(partnerId);
    const partner = await this.getPartnerConfig(partnerId);

    await this.axiosInstance.post(
      "/api/v1/emeterai/stamping-meterai-onpremis",
      {
        client_id: partner.emeterai_client_id,
        transaction_id: transactionId,
        sn_emeterai: snMeterai,
        lowerLeftX: 475,
        lowerLeftY: 30,
        upperRightX: 571,
        upperRightY: 96,
        page: 1,
      },
      {
        headers: {Authorization: token},
      }
    );
  }

  private async downloadStampedDocument(
    applicationId: number,
    transactionId: string,
    partnerId: number
  ): Promise<string> {
    const token = await this.tokenManager.getEmeteraiToken(partnerId);
    const partner = await this.getPartnerConfig(partnerId);

    const response = await this.axiosInstance.post(
      "/api/v1/emeterai/download-document-onpremis",
      {
        client_id: partner.emeterai_client_id,
        transaction_id: transactionId,
      },
      {
        headers: {Authorization: token},
        responseType: "arraybuffer",
      }
    );

    const pdfBuffer = Buffer.from(response.data);
    const fileName = `kyc_${applicationId}_stamped_${Date.now()}.pdf`;

    return await this.cdnService.uploadFile(
      pdfBuffer,
      fileName,
      "application/pdf"
    );
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(`Operation failed, retry ${i + 1}/${maxRetries}`, {
          error,
        });

        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError;
  }
}
