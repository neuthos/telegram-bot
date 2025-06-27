// src/services/FileService.ts - Update untuk compressed images

import TelegramBot from "node-telegram-bot-api";
import {Logger} from "../config/logger";
import {CDNService} from "./CDNService";

export class FileService {
  private logger = Logger.getInstance();
  private cdnService = new CDNService();

  public async downloadAndUploadPhoto(
    bot: TelegramBot,
    fileId: string,
    telegramId: number,
    photoType: string,
    useCompressed: boolean = true
  ): Promise<{fileUrl: string; fileName: string; fileSize: number}> {
    try {
      const file = await bot.getFile(fileId);

      if (!file.file_path) {
        throw new Error("File path not available");
      }

      const extension = file.file_path.split(".").pop() || "jpg";
      const fileName = `${photoType}_${telegramId}_${Date.now()}.${extension}`;

      const fileStream = bot.getFileStream(fileId);
      const chunks: Buffer[] = [];

      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);
      const mimeType = `image/${extension}`;

      const fileUrl = await this.cdnService.uploadFile(
        fileBuffer,
        fileName,
        mimeType
      );

      this.logger.info("Photo uploaded successfully:", {
        telegramId,
        photoType,
        fileName,
        fileUrl,
        fileSize: fileBuffer.length,
        compressed: useCompressed,
      });

      return {
        fileUrl,
        fileName,
        fileSize: fileBuffer.length,
      };
    } catch (error) {
      this.logger.error("Error uploading photo:", {
        telegramId,
        photoType,
        fileId,
        error,
      });
      throw error;
    }
  }

  public getCompressedPhotoFileId(photoSizes: TelegramBot.PhotoSize[]): string {
    if (photoSizes.length === 0) {
      throw new Error("No photo sizes available");
    }
    const sortedSizes = photoSizes.sort(
      (a, b) => (a.file_size || 0) - (b.file_size || 0)
    );

    let selectedPhoto: TelegramBot.PhotoSize;

    if (sortedSizes.length >= 3) {
      selectedPhoto = sortedSizes[Math.floor(sortedSizes.length / 2)];
    } else if (sortedSizes.length === 2) {
      selectedPhoto = sortedSizes[0];
    } else {
      selectedPhoto = sortedSizes[0];
    }

    this.logger.info("Selected compressed photo", {
      totalSizes: sortedSizes.length,
      selectedSize: selectedPhoto.file_size,
      selectedDimensions: `${selectedPhoto.width}x${selectedPhoto.height}`,
    });

    return selectedPhoto.file_id;
  }

  public async downloadOriginalFile(
    bot: TelegramBot,
    fileId: string
  ): Promise<{buffer: Buffer; mimeType: string; fileName: string}> {
    try {
      const file = await bot.getFile(fileId);

      if (!file.file_path) {
        throw new Error("File path not available");
      }

      const fileStream = bot.getFileStream(fileId);
      const chunks: Buffer[] = [];

      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const extension = file.file_path.split(".").pop() || "jpg";
      const mimeType = `image/${extension}`;
      const fileName = `ktp_${Date.now()}.${extension}`;

      return {buffer, mimeType, fileName};
    } catch (error) {
      this.logger.error("Error downloading original file:", {fileId, error});
      throw error;
    }
  }

  public async uploadOriginalFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{fileUrl: string; fileName: string; fileSize: number}> {
    try {
      const fileUrl = await this.cdnService.uploadFile(
        fileBuffer,
        fileName,
        mimeType
      );

      this.logger.info("Original file uploaded successfully:", {
        fileName,
        fileUrl,
        fileSize: fileBuffer.length,
      });

      return {
        fileUrl,
        fileName,
        fileSize: fileBuffer.length,
      };
    } catch (error) {
      this.logger.error("Error uploading original file:", {fileName, error});
      throw error;
    }
  }
}
