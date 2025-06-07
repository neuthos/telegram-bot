import axios from "axios";
import FormData from "form-data";
import {Logger} from "../config/logger";

export class CDNService {
  private logger = Logger.getInstance();
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.CDN_BASE_URL!;
    this.apiKey = process.env.CDN_API_KEY!;
  }

  public async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      });

      const response = await axios.post(
        `${this.baseURL}/api/v1/files/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            // Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      this.logger.info("File uploaded to CDN:", {
        fileName,
        fileUrl: response.data.file_url,
      });

      return response.data.file_url;
    } catch (error) {
      this.logger.error("Error uploading to CDN:", {fileName, error});
      throw error;
    }
  }
}
