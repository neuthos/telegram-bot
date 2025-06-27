import {Logger} from "../config/logger";
import {OCRKTPResponse} from "../types";

export class OCRService {
  private logger = Logger.getInstance();
  private ocrApiUrl: string;

  constructor() {
    this.ocrApiUrl = process.env.OCR_API_URL || "http://localhost:8000";
  }

  public async processKTPImage(imageUrl: string): Promise<OCRKTPResponse> {
    try {
      this.logger.info("Processing KTP image with OCR", {imageUrl});

      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();

      const formData = new FormData();
      formData.append("file", imageBlob, "ktp.jpg");
      const response = await fetch(`${this.ocrApiUrl}/extract-ktp`, {
        method: "POST",
        body: formData,
      });
      console.log({response});

      const result = await response.json();

      if (result.success && result.data) {
        const requiredFields = ["nik", "nama", "alamat", "provinsi", "kota"];
        const missingFields = requiredFields.filter(
          (field) => !result.data[field]
        );

        if (missingFields.length > 0) {
          return {
            success: false,
            message: `Required fields not detected: ${missingFields.join(
              ", "
            )}. Please retake photo with better quality.`,
          };
        }
      }

      return result;
    } catch (error) {
      console.log({error});
      this.logger.error("OCR processing failed", {error, imageUrl});
      return {
        success: false,
        message: `OCR processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  public async processKTPFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<OCRKTPResponse> {
    try {
      this.logger.info("Processing KTP file buffer", {fileName, mimeType});

      const formData = new FormData();
      const blob = new Blob([fileBuffer], {type: mimeType});
      formData.append("file", blob, fileName);

      const response = await fetch(`${this.ocrApiUrl}/extract-ktp`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const requiredFields = ["nik", "nama", "alamat", "provinsi", "kota"];
        const missingFields = requiredFields.filter(
          (field) => !result.data[field]
        );

        if (missingFields.length > 0) {
          return {
            success: false,
            message: `Required fields not detected: ${missingFields.join(
              ", "
            )}. Please retake photo with better quality.`,
          };
        }
      }

      return result;
    } catch (error) {
      console.log(error);
      this.logger.error("OCR processing failed", {error, fileName});
      return {
        success: false,
        message: `OCR processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  public async validateKTPData(data: any): Promise<boolean> {
    if (!data.full_name || data.full_name.length < 3) return false;
    if (!data.address || data.address.length < 10) return false;
    if (!data.id_card_number || !/^\d{16}$/.test(data.id_card_number))
      return false;

    return true;
  }
}
