import {google} from "googleapis";
import {Logger} from "../config/logger";
import axios from "axios";

export class GoogleDriveService {
  private drive: any;
  private logger = Logger.getInstance();

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    this.drive = google.drive({version: "v3", auth});
  }

  async createDateFolder(
    date: string,
    parentFolderId?: string
  ): Promise<string> {
    try {
      // Check if folder exists
      const existingFolder = await this.findFolder(date, parentFolderId);
      if (existingFolder) {
        return existingFolder;
      }

      // Create new folder
      const folderMetadata = {
        name: date,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: "id",
      });

      this.logger.info("Created Google Drive folder:", {
        date,
        folderId: folder.data.id,
      });
      return folder.data.id;
    } catch (error) {
      this.logger.error("Error creating Google Drive folder:", error);
      throw error;
    }
  }

  async findFolder(
    name: string,
    parentFolderId?: string
  ): Promise<string | null> {
    try {
      const query = parentFolderId
        ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents`
        : `name='${name}' and mimeType='application/vnd.google-apps.folder'`;

      const response = await this.drive.files.list({
        q: query,
        fields: "files(id, name)",
      });

      return response.data.files.length > 0 ? response.data.files[0].id : null;
    } catch (error) {
      this.logger.error("Error finding Google Drive folder:", error);
      return null;
    }
  }

  async uploadPDF(
    pdfUrl: string,
    fileName: string,
    folderId: string
  ): Promise<string> {
    try {
      // Download PDF from URL
      const response = await axios.get(pdfUrl, {responseType: "stream"});

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: "application/pdf",
        body: response.data,
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });

      // Make file publicly viewable
      await this.drive.permissions.create({
        fileId: file.data.id,
        resource: {
          role: "reader",
          type: "anyone",
        },
      });

      const driveUrl = `https://drive.google.com/file/d/${file.data.id}/view`;

      this.logger.info("Uploaded PDF to Google Drive:", {
        fileName,
        fileId: file.data.id,
      });
      return driveUrl;
    } catch (error) {
      this.logger.error("Error uploading PDF to Google Drive:", error);
      throw error;
    }
  }

  async uploadExcel(
    excelBuffer: Buffer,
    fileName: string,
    folderId: string
  ): Promise<string> {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from(excelBuffer),
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });

      // Make file publicly viewable
      await this.drive.permissions.create({
        fileId: file.data.id,
        resource: {
          role: "reader",
          type: "anyone",
        },
      });

      const driveUrl = `https://drive.google.com/file/d/${file.data.id}/view`;

      this.logger.info("Uploaded Excel to Google Drive:", {
        fileName,
        fileId: file.data.id,
      });
      return driveUrl;
    } catch (error) {
      this.logger.error("Error uploading Excel to Google Drive:", error);
      throw error;
    }
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  public getTodayFolderName(): string {
    return this.formatDate(new Date());
  }
}
