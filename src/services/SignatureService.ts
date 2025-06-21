import {Logger} from "../config/logger";
import {SignatureProcessResponse} from "../types";

export class SignatureService {
  private logger = Logger.getInstance();
  private signatureApiUrl: string;
  private apiKey?: string;

  constructor() {
    this.signatureApiUrl =
      process.env.SIGNATURE_API_URL ||
      "https://api.signature-service.com/process";
    this.apiKey = process.env.SIGNATURE_API_KEY;
  }

  public async processSignatureImage(
    imageUrl: string
  ): Promise<SignatureProcessResponse> {
    try {
      this.logger.info("Processing signature image", {imageUrl});

      // Sementara return dummy data karena belum ada API URL
      if (
        !this.apiKey ||
        this.signatureApiUrl.includes("api.signature-service.com")
      ) {
        this.logger.warn("Signature API not configured, returning dummy data");
        return this.getDummySignatureData(imageUrl);
      }

      const response = await fetch(this.signatureApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          image_url: imageUrl,
          remove_background: true,
          target_width: 200, // Same as current initial signature
          target_height: 60, // Same as current initial signature
          format: "png",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Signature API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      this.logger.info("Signature processing completed", {
        success: result.success,
        hasProcessedImage: !!result.data?.processed_image_url,
      });

      return {
        success: result.success,
        data: result.data
          ? {
              processed_image_url: result.data.processed_image_url,
              width: result.data.width || 200,
              height: result.data.height || 60,
            }
          : undefined,
        message: result.message,
      };
    } catch (error) {
      this.logger.error("Signature processing failed", {error, imageUrl});

      // Return dummy processed signature even on error untuk testing
      this.logger.warn("Returning dummy processed signature due to API error");
      return this.getDummySignatureData(imageUrl);
    }
  }

  private getDummySignatureData(originalUrl: string): SignatureProcessResponse {
    // Untuk testing, kita return URL yang sama tapi dengan parameter processed
    const processedUrl = `${originalUrl}?processed=true&bg_removed=true&w=200&h=60`;

    return {
      success: true,
      data: {
        processed_image_url: processedUrl,
        width: 200,
        height: 60,
      },
      message:
        "Signature processing completed (dummy data - background removed)",
    };
  }

  public validateSignatureImage(imageUrl: string): boolean {
    // Basic validation
    if (!imageUrl) return false;
    if (!imageUrl.match(/\.(jpg|jpeg|png|gif)$/i)) return false;

    return true;
  }

  public getSignatureDimensions(): {width: number; height: number} {
    // Return standard dimensions yang sama dengan signature_initial sebelumnya
    return {
      width: 200,
      height: 60,
    };
  }
}
