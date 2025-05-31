import fs from "fs-extra";
import path from "path";
import {v4 as uuidv4} from "uuid";
import TelegramBot from "node-telegram-bot-api";
import {Logger} from "../config/logger";

export class FileService {
  private logger = Logger.getInstance();
  private uploadPath: string;

  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || "uploads/kyc";
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await fs.ensureDir(this.uploadPath);
    } catch (error) {
      this.logger.error("Error creating upload directory:", error);
      throw error;
    }
  }

  public async downloadAndSavePhoto(
    bot: TelegramBot,
    fileId: string,
    telegramId: number,
    photoType: string
  ): Promise<{filePath: string; fileName: string; fileSize: number}> {
    try {
      // Get file info from Telegram
      const file = await bot.getFile(fileId);

      if (!file.file_path) {
        throw new Error("File path not available");
      }

      // Generate unique filename
      const extension = path.extname(file.file_path) || ".jpg";
      const fileName = `${photoType}_${uuidv4()}${extension}`;
      const userDir = path.join(this.uploadPath, telegramId.toString());

      // Ensure user directory exists
      await fs.ensureDir(userDir);

      const filePath = path.join(userDir, fileName);

      // Download file from Telegram
      const fileStream = bot.getFileStream(fileId);
      const writeStream = fs.createWriteStream(filePath);

      await new Promise((resolve: any, reject) => {
        fileStream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        fileStream.on("error", reject);
      });

      // Get file stats
      const stats = await fs.stat(filePath);

      this.logger.info("Photo saved successfully:", {
        telegramId,
        photoType,
        fileName,
        fileSize: stats.size,
      });

      return {
        filePath: filePath,
        fileName: fileName,
        fileSize: stats.size,
      };
    } catch (error) {
      this.logger.error("Error downloading and saving photo:", {
        telegramId,
        photoType,
        fileId,
        error,
      });
      throw error;
    }
  }

  public async deletePhoto(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
      this.logger.info("Photo deleted:", {filePath});
    } catch (error) {
      this.logger.error("Error deleting photo:", {filePath, error});
      // Don't throw error for file deletion failures
    }
  }

  public async getUserPhotos(telegramId: number): Promise<string[]> {
    try {
      const userDir = path.join(this.uploadPath, telegramId.toString());

      if (!(await fs.pathExists(userDir))) {
        return [];
      }

      const files = await fs.readdir(userDir);
      return files.map((file: any) => path.join(userDir, file));
    } catch (error) {
      this.logger.error("Error getting user photos:", {telegramId, error});
      return [];
    }
  }
}
