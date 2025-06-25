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
      // 1. Get all confirmed and stamped applications
      const applications =
        await this.sessionService.getAllConfirmedAndStamped();

      if (applications.length === 0) {
        return {success: true, processedCount: 0};
      }

      this.logger.info(
        `Processing ${applications.length} stamped applications`
      );

      // 2. Create or get today's folder
      const dateFolder = this.googleDriveService.getTodayFolderName();
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
      const folderId = await this.googleDriveService.createDateFolder(
        dateFolder,
        parentFolderId
      );

      // 3. Upload PDFs to Google Drive and collect URLs
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

            // Update application with Google Drive URL
            await this.sessionService.updateGoogleDriveUrl(app.id!, driveUrl);
            app.google_drive_url = driveUrl; // Update for Excel export
            applicationIds.push(app.id!);
          }
        } catch (error) {
          this.logger.error(
            `Error uploading PDF for application ${app.id}:`,
            error
          );
        }
      }

      // 4. Generate Excel with Google Drive URLs
      const excelBuffer = await this.excelExportService.exportToExcelBuffer(
        applications as KYCApplication[]
      );

      // 5. Upload Excel to Google Drive
      const excelFileName = `KYC_Export_${dateFolder}.xlsx`;
      const excelDriveUrl = await this.googleDriveService.uploadExcel(
        excelBuffer,
        excelFileName,
        folderId
      );

      // 6. Mark applications as reviewed by Artajasa
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
