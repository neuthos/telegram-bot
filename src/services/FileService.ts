// src/services/FileService.ts
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import FormData from "form-data";
import {Logger} from "../config/logger";
import {CDNService} from "./CDNService";
import path from "path";

export class FileService {
  private cdnService: CDNService;
  private logger = Logger.getInstance();

  constructor() {
    this.cdnService = new CDNService();
  }

  async downloadAndUploadPhoto(
    bot: TelegramBot,
    fileId: string,
    folderPath: string,
    photoType: string
  ): Promise<{url: string; fileName: string}> {
    try {
      const file = await bot.getFile(fileId);

      // Get token from bot instance
      const botInfo = bot as any;
      const token = botInfo.token || botInfo._token || botInfo.options?.token;

      if (!token) {
        throw new Error("Bot token not accessible");
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);
      const extension = path.extname(file.file_path || ".jpg");
      const fileName = `${photoType}_${Date.now()}${extension}`;

      const uploadedUrl = await this.cdnService.uploadFile(
        buffer,
        fileName,
        `image/${extension.substring(1)}`,
        folderPath
      );

      this.logger.info("Photo uploaded successfully", {
        fileId,
        fileName,
        uploadedUrl,
        folderPath,
      });

      return {
        url: uploadedUrl,
        fileName,
      };
    } catch (error) {
      this.logger.error("Error downloading/uploading photo:", error);
      throw error;
    }
  }

  async downloadFile(bot: TelegramBot, fileId: string): Promise<Buffer> {
    try {
      const file = await bot.getFile(fileId);

      // Get token from bot instance
      const botInfo = bot as any;
      const token = botInfo.token || botInfo._token || botInfo.options?.token;

      if (!token) {
        throw new Error("Bot token not accessible");
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error("Error downloading file:", error);
      throw error;
    }
  }
}
