import axios, {AxiosInstance} from "axios";
import FormData from "form-data";
import crypto from "crypto";
import {Logger} from "../config/logger";
import {SessionService} from "./SessionServices";
import {CDNService} from "./CDNService";

export class EmeteraiService {
  private logger = Logger.getInstance();
  private sessionService = new SessionService();
  private cdnService = new CDNService();
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
    stampedBy: string
  ): Promise<void> {
    try {
      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "getting_token"
      );

      await this.retryOperation(() => this.getValidToken(applicationId));

      const application = await this.sessionService.getKYCApplicationById(
        applicationId
      );

      if (!application?.pdf_url) {
        throw new Error("PDF not found");
      }

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "uploading_document"
      );

      // 2. Upload Document dengan retry
      const transactionId = await this.retryOperation(() =>
        this.uploadDocument(applicationId, stampedBy)
      );

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "generating_sn"
      );

      // 3. Generate SN dengan retry
      const snMeterai = await this.retryOperation(() =>
        this.generateSN(applicationId, transactionId)
      );

      await this.sessionService.updateEmeteraiStatus(applicationId, "stamping");

      // 4. Stamp Document dengan retry
      await this.retryOperation(() =>
        this.stampDocument(applicationId, transactionId, snMeterai)
      );

      await this.sessionService.updateEmeteraiStatus(
        applicationId,
        "downloading"
      );

      // 5. Download dengan retry
      const stampedPdfUrl = await this.retryOperation(() =>
        this.downloadStampedDocument(applicationId, transactionId)
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
      this.logger.error("E-meterai processing failed:", {applicationId, error});
      throw error;
    }
  }

  public async pdfConvert(applicationId: number, pdfBuffer: any): Promise<any> {
    const token = await this.getValidToken(applicationId);

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

    // Convert arraybuffer to Buffer directly
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

  private async getValidToken(applicationId: number): Promise<string> {
    const application = await this.sessionService.getKYCApplicationById(
      applicationId
    );
    if (application?.emeterai_token && application?.emeterai_token_expires) {
      if (new Date(application.emeterai_token_expires) > new Date()) {
        return application.emeterai_token;
      }
    }

    const response = await this.axiosInstance.post("/api/v1/client/get-token", {
      client_id: process.env.EMETERAI_CLIENT_ID,
      client_email: process.env.EMETERAI_CLIENT_EMAIL,
      client_password: process.env.EMETERAI_CLIENT_PASSWORD,
    });

    const tokenData = response.data.data.MCPToken.Token;
    await this.sessionService.updateEmeteraiToken(
      applicationId,
      tokenData.jwt,
      new Date(tokenData.expiredDate)
    );

    return tokenData.jwt;
  }

  private async uploadDocument(
    applicationId: number,
    stampedBy: string
  ): Promise<string> {
    const token = await this.getValidToken(applicationId);
    const application = await this.sessionService.getKYCApplicationById(
      applicationId
    );

    const pdfResponse = await axios.get(application!.pdf_url!, {
      responseType: "arraybuffer",
    });
    const pdfBuffer = Buffer.from(pdfResponse.data);
    const formData = new FormData();
    formData.append("client_id", process.env.EMETERAI_CLIENT_ID);
    formData.append("email_uploader", process.env.EMETERAI_CLIENT_EMAIL);
    formData.append("doc_number", `KYC${applicationId}_${Date.now()}`);
    formData.append("doc_date", new Date().toISOString().split("T")[0]);
    formData.append("doc_upload", pdfBuffer, `kyc_${applicationId}.pdf`);
    formData.append("email_stamper", process.env.EMETERAI_CLIENT_EMAIL);
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
    transactionId: string
  ): Promise<string> {
    const token = await this.getValidToken(applicationId);

    const rulesXReqSignature = `${process.env.EMETERAI_CLIENT_ID}${transactionId}`;
    const signatureKey = crypto
      .createHash("sha256")
      .update(rulesXReqSignature)
      .digest("hex");

    const response = await this.axiosInstance.post(
      "/api/v1/emeterai/generate-meterai-onpremis-single",
      {
        client_id: process.env.EMETERAI_CLIENT_ID,
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
    applicationId: number,
    transactionId: string,
    snMeterai: string
  ): Promise<void> {
    const token = await this.getValidToken(applicationId);

    await this.axiosInstance.post(
      "/api/v1/emeterai/stamping-meterai-onpremis",
      {
        client_id: process.env.EMETERAI_CLIENT_ID,
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
    transactionId: string
  ): Promise<string> {
    const token = await this.getValidToken(applicationId);

    const response = await this.axiosInstance.post(
      "/api/v1/emeterai/download-document-onpremis",
      {
        client_id: process.env.EMETERAI_CLIENT_ID,
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
