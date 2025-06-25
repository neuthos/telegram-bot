import {Logger} from "../config/logger";
import {SignatureProcessResponse} from "../types";

export class SignatureService {
  private logger = Logger.getInstance();
  private signatureApiUrl: string;

  constructor() {
    this.signatureApiUrl =
      process.env.SIGNATURE_API_URL || "http://localhost:5000";
  }

  public async processSignatureImage(
    imageUrl: string
  ): Promise<SignatureProcessResponse> {
    try {
      this.logger.info("Processing signature image", {imageUrl});

      // Use our signature extraction API
      const response = await fetch(
        `${this.signatureApiUrl}/extract-signature-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: imageUrl,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Signature API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      this.logger.info("Signature processing completed", {
        success: result.success,
        hasProcessedImage: !!result.file_url,
      });

      return {
        success: result.success,
        data: result.success
          ? {
              processed_image_url: result.file_url,
              width: result.dimensions?.width || 200,
              height: result.dimensions?.height || 60,
            }
          : undefined,
        message: result.message || result.error,
      };
    } catch (error) {
      this.logger.error("Signature processing failed", {error, imageUrl});

      return {
        success: false,
        message: `Processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  public async processSignatureFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<SignatureProcessResponse> {
    try {
      this.logger.info("Processing signature file", {fileName, mimeType});
      const formData = new FormData();
      const blob = new Blob([fileBuffer], {type: mimeType});
      formData.append("image", blob, fileName);

      const response = await fetch(
        `${this.signatureApiUrl}/extract-signature`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Signature API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      this.logger.info("Signature file processing completed", {
        success: result.success,
        hasProcessedImage: !!result.file_url,
      });

      return {
        success: result.success,
        data: result.success
          ? {
              processed_image_url: result.file_url,
              width: result.dimensions?.width || 200,
              height: result.dimensions?.height || 60,
            }
          : undefined,
        message: result.message || result.error,
      };
    } catch (error) {
      this.logger.error("Signature file processing failed", {error, fileName});

      return {
        success: false,
        message: `Processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  public validateSignatureImage(imageUrl: string): boolean {
    // Basic validation
    if (!imageUrl) return false;
    if (!imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return false;

    return true;
  }

  public validateSignatureFile(fileName: string, mimeType: string): boolean {
    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const allowedExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

    return allowedTypes.includes(mimeType) && allowedExtensions.test(fileName);
  }

  public getSignatureDimensions(): {width: number; height: number} {
    return {
      width: 200,
      height: 60,
    };
  }

  private getDummySignatureData(originalUrl: string): SignatureProcessResponse {
    // Fallback dummy data
    const processedUrl = `${originalUrl}?processed=true&bg_removed=true&w=200&h=60`;

    return {
      success: true,
      data: {
        processed_image_url: processedUrl,
        width: 200,
        height: 60,
      },
      message: "Signature processing completed (background removed)",
    };
  }
}
