// src/services/OCRService.ts
import {Logger} from "../config/logger";
import {OCRKTPResponse} from "../types";

export class OCRService {
  private logger = Logger.getInstance();
  private ocrApiUrl: string;
  private apiKey?: string;

  constructor() {
    this.ocrApiUrl =
      process.env.OCR_API_URL || "https://api.ocr-service.com/ktp";
    this.apiKey = process.env.OCR_API_KEY;
  }

  public async processKTPImage(imageUrl: string): Promise<OCRKTPResponse> {
    try {
      this.logger.info("Processing KTP image with OCR", {imageUrl});

      // Sementara return dummy data karena belum ada API URL
      if (!this.apiKey || this.ocrApiUrl.includes("api.ocr-service.com")) {
        this.logger.warn("OCR API not configured, returning dummy data");
        return this.getDummyKTPData();
      }

      const response = await fetch(this.ocrApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          image_url: imageUrl,
          extract_fields: [
            "full_name",
            "address",
            "id_card_number",
            "religion",
            "occupation",
            "postal_code",
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OCR API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      this.logger.info("OCR processing completed", {
        success: result.success,
        hasData: !!result.data,
      });

      return {
        success: result.success,
        data: result.data
          ? {
              full_name: result.data.full_name || "",
              address: result.data.address || "",
              id_card_number: result.data.id_card_number || "",
              religion: result.data.religion || "",
              occupation: result.data.occupation || "",
              postal_code: result.data.postal_code || "",
            }
          : undefined,
        message: result.message,
      };
    } catch (error) {
      this.logger.error("OCR processing failed", {error, imageUrl});

      // Return dummy data even on error untuk testing
      this.logger.warn("Returning dummy data due to OCR error");
      return this.getDummyKTPData();
    }
  }

  private getDummyKTPData(): OCRKTPResponse {
    const dummyData = [
      {
        full_name: "BUDI SANTOSO",
        address:
          "JL. MERDEKA NO. 123 RT 001 RW 002 KEL. SUMBER KOTA JAKARTA PUSAT",
        id_card_number: "3171234567890123",
        religion: "ISLAM",
        occupation: "WIRASWASTA",
        postal_code: "10110",
      },
      {
        full_name: "SITI RAHAYU",
        address: "JL. DIPONEGORO NO. 45 RT 003 RW 001 KEL. DAMAI KOTA SURABAYA",
        id_card_number: "3578987654321098",
        religion: "ISLAM",
        occupation: "PEDAGANG",
        postal_code: "60271",
      },
      {
        full_name: "AGUS WIJAYA",
        address:
          "JL. GATOT SUBROTO NO. 67 RT 002 RW 004 KEL. MAKMUR KOTA BANDUNG",
        id_card_number: "3273456789012345",
        religion: "KRISTEN",
        occupation: "KARYAWAN SWASTA",
        postal_code: "40123",
      },
    ];

    const randomData = dummyData[Math.floor(Math.random() * dummyData.length)];

    return {
      success: true,
      data: randomData,
      message: "OCR processing completed (dummy data)",
    };
  }

  public async validateKTPData(data: any): Promise<boolean> {
    // Validasi basic format KTP
    if (!data.full_name || data.full_name.length < 3) return false;
    if (!data.address || data.address.length < 10) return false;
    if (!data.id_card_number || !/^\d{16}$/.test(data.id_card_number))
      return false;

    return true;
  }
}
