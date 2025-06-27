import {SessionService} from "./SessionServices";
import {GoogleDriveService} from "./GoogleDriveService";
import {ExcelExportService} from "./ExcelExportService";
import {Logger} from "../config/logger";
import {KYCApplication} from "../types";

export class ArtajasaService {
  private sessionService = new SessionService();
  private googleDriveService = new GoogleDriveService();
  private excelExportService = new ExcelExportService();
  private logger = Logger.getInstance();

  async processStampedApplications(): Promise<{
    success: boolean;
    processedCount: number;
    excelUrl?: string;
    folderId?: string;
  }> {
    try {
      const applications =
        await this.sessionService.getAllConfirmedAndStamped();

      if (applications.length === 0) {
        return {success: true, processedCount: 0};
      }

      this.logger.info(
        `Processing ${applications.length} stamped applications`
      );

      const dateFolder = this.googleDriveService.getTodayFolderName();
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
      const folderId = await this.googleDriveService.createDateFolder(
        dateFolder,
        parentFolderId
      );

      const applicationIds: number[] = [];
      for (const app of applications) {
        try {
          if (app.stamped_pdf_url) {
            const fileName = `KYC_${app.agent_name}_${app.id}.pdf`;
            const driveUrl = await this.googleDriveService.uploadPDF(
              app.stamped_pdf_url,
              fileName,
              folderId
            );

            await this.sessionService.updateGoogleDriveUrl(app.id!, driveUrl);
            app.google_drive_url = driveUrl;
            applicationIds.push(app.id!);
          }
        } catch (error) {
          this.logger.error(
            `Error uploading PDF for application ${app.id}:`,
            error
          );
        }
      }

      const {buffer: excelBuffer, fileName: excelFileName} =
        await this.excelExportService.exportToExcelBuffer(
          applications as KYCApplication[]
        );

      const excelDriveUrl = await this.googleDriveService.uploadExcel(
        excelBuffer,
        excelFileName,
        folderId
      );

      await this.sessionService.markAsReviewedByArtajasa(applicationIds);

      this.logger.info("Artajasa processing completed", {
        processedCount: applicationIds.length,
        excelUrl: excelDriveUrl,
        folderId,
      });

      return {
        success: true,
        processedCount: applicationIds.length,
        excelUrl: excelDriveUrl,
        folderId,
      };
    } catch (error) {
      this.logger.error("Error processing stamped applications:", error);
      throw error;
    }
  }
}
