import {Request, Response} from "express";
import {ApiResponse, AuthRequest} from "../middleware/authMiddleware";
import {SessionService} from "../../services/SessionServices";
import {PDFService} from "../../services/PdfService";
import {Logger} from "../../config/logger";
import path from "path";
import fs from "fs-extra";
import {EmeteraiService} from "../../services/EMateraiService";
import {
  BulkConfirmRequest,
  BulkRejectRequest,
  ConfirmRequest,
} from "../../types";
import TelegramBot from "node-telegram-bot-api";
import {MessageTemplates} from "../../messages/MessagesTemplates";
import {ExcelExportService} from "../../services/ExcelExportService";
import {ArtajasaService} from "../../services/ArtajasaService";

export class KYCController {
  private sessionService = new SessionService();
  private pdfService = new PDFService();
  private logger = Logger.getInstance();
  private excelExportService = new ExcelExportService();

  public getList = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const partnerId = req.partnerId!;
      const applications = await this.sessionService.getAllKYCApplications(
        partnerId
      );

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      this.logger.error("Error getting KYC list:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  public exportPdf = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const partnerId = req.partnerId!;

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id),
        partnerId
      );
      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      if (application.status !== "confirmed") {
        res.status(400).json({
          success: false,
          message: "Can only export confirmed applications",
        });
        return;
      }

      const photos = await this.sessionService.getApplicationPhotos(
        parseInt(id)
      );
      const pdfUrl = await this.pdfService.generateKYCPDF(application, photos);

      await this.sessionService.updateApplicationPdfUrl(parseInt(id), pdfUrl);

      res.json({
        success: true,
        message: "PDF generated successfully",
        data: {
          pdf_url: pdfUrl,
          status: application.status,
        },
      });
    } catch (error) {
      this.logger.error("Error exporting PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate PDF",
      });
    }
  };

  public bulkExportPdf = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {ids} = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array is required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          if (application.status !== "confirmed") {
            errors.push({id, error: "Application not confirmed"});
            continue;
          }

          if (application.pdf_url) {
            results.push({
              id,
              pdf_url: application.pdf_url,
              status: "existing",
            });
            continue;
          }

          const photos = await this.sessionService.getApplicationPhotos(id);
          const pdfUrl = await this.pdfService.generateKYCPDF(
            application,
            photos
          );

          await this.sessionService.updateApplicationPdfUrl(id, pdfUrl);

          results.push({
            id,
            pdf_url: pdfUrl,
            status: "generated",
          });
        } catch (error) {
          this.logger.error(`Error generating PDF for ID ${id}:`, error);
          errors.push({id, error: "PDF generation failed"});
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.length} PDFs, ${errors.length} errors`,
        data: {
          results,
          errors,
        },
      });
    } catch (error) {
      this.logger.error("Error in bulk PDF export:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process bulk PDF export",
      });
    }
  };

  public confirmApplication = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {name, initial}: ConfirmRequest = req.body;
      if (!name || !initial) {
        res.status(400).json({
          success: false,
          message: "Name, initial, and partner_name are required",
        });
        return;
      }
      const partnerResult = await this.sessionService.db.query(
        "SELECT name FROM bot_partners WHERE id = $1",
        [req.partnerId]
      );

      const partnerName = partnerResult.rows[0]?.name || "Partner";

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id),
        req.partnerId
      );

      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      if (application.status !== "draft") {
        res.status(400).json({
          success: false,
          message: "Can only confirm draft applications",
        });
        return;
      }

      const photos = await this.sessionService.getApplicationPhotos(
        parseInt(id)
      );
      const updatedApplication =
        await this.sessionService.getKYCApplicationById(parseInt(id));

      const pdfUrl = await this.pdfService.generateKYCPDF(
        updatedApplication!,
        photos
      );
      await this.sessionService.updateApplicationPdfUrl(parseInt(id), pdfUrl);

      await this.sessionService.updateApplicationStatusWithAdmin(
        parseInt(id),
        "confirmed",
        name,
        initial,
        partnerName
      );

      await this.sendTelegramNotification(
        application.telegram_id,
        "confirmed",
        {
          pdfUrl,
          application: updatedApplication,
        },
        req.partnerId as number
      );

      res.json({
        success: true,
        message: "Application confirmed successfully",
        data: {
          id: parseInt(id),
          status: "confirmed",
          pdf_url: pdfUrl,
        },
      });
    } catch (error) {
      this.logger.error("Error confirming application:", error);
      res.status(500).json({
        success: false,
        message: "Failed to confirm application",
      });
    }
  };

  public bulkConfirmApplications = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {ids, name, initial, partner_name}: BulkConfirmRequest = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array is required",
        });
        return;
      }

      if (!name || !initial || !partner_name) {
        res.status(400).json({
          success: false,
          message: "Name, initial, and partner_name are required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          if (application.status !== "draft") {
            errors.push({id, error: "Can only confirm draft applications"});
            continue;
          }

          await this.sessionService.updateApplicationStatusWithAdmin(
            id,
            "confirmed",
            name,
            initial,
            partner_name
          );

          const photos = await this.sessionService.getApplicationPhotos(id);
          const updatedApplication =
            await this.sessionService.getKYCApplicationById(id);
          const pdfUrl = await this.pdfService.generateKYCPDF(
            updatedApplication!,
            photos
          );
          await this.sessionService.updateApplicationPdfUrl(id, pdfUrl);

          try {
            await this.sendTelegramNotification(
              application.telegram_id,
              "confirmed",
              {
                pdfUrl,
                application: updatedApplication,
              },
              req.partnerId as number
            );
          } catch (telegramError) {
            this.logger.error(
              `Telegram notification failed for ID ${id}:`,
              telegramError
            );
          }

          results.push({
            id,
            status: "confirmed",
            pdf_url: pdfUrl,
            confirmed_by: name,
            confirmed_at: new Date(),
          });
        } catch (error) {
          this.logger.error(`Error confirming application ID ${id}:`, error);
          errors.push({id, error: "Confirmation failed"});
        }
      }

      res.json({
        success: true,
        message: `Confirmed ${results.length} applications, ${errors.length} errors`,
        data: {
          results,
          errors,
          confirmed_by: {
            name,
            initial,
            partner_name,
          },
        },
      });
    } catch (error) {
      this.logger.error("Error in bulk confirm:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process bulk confirmation",
      });
    }
  };

  public rejectApplication = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {
        remark,
        name,
        initial,
        partner_name,
      }: {
        remark: string;
        name: string;
        initial: string;
        partner_name: string;
      } = req.body;

      if (!remark || remark.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Remark is required",
        });
        return;
      }

      if (!name || !initial || !partner_name) {
        res.status(400).json({
          success: false,
          message: "Name, initial, and partner_name are required for rejection",
        });
        return;
      }

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );
      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      if (application.status !== "draft") {
        res.status(400).json({
          success: false,
          message: "Can only reject draft applications",
        });
        return;
      }

      await this.sessionService.rejectApplication(
        parseInt(id),
        remark.trim(),
        name,
        initial,
        partner_name
      );

      try {
        await this.sendTelegramNotification(
          application.telegram_id,
          "rejected",
          {
            remark: remark.trim(),
          },
          req.partnerId as number
        );
      } catch (telegramError) {
        console.error("Failed to send Telegram notification:", telegramError);
        this.logger.error(
          "Telegram notification failed but continuing:",
          telegramError
        );
      }

      res.json({
        success: true,
        message: "Application rejected successfully",
        data: {
          id: parseInt(id),
          status: "rejected",
          remark: remark.trim(),
          rejected_by: name,
          rejected_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error("Error rejecting application:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject application",
      });
    }
  };

  public bulkRejectApplications = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {applications, name, initial, partner_name}: BulkRejectRequest =
        req.body;

      if (!Array.isArray(applications) || applications.length === 0) {
        res.status(400).json({
          success: false,
          message: "Applications array is required",
        });
        return;
      }

      if (!name || !initial || !partner_name) {
        res.status(400).json({
          success: false,
          message: "Admin info (name, initial, partner_name) is required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const app of applications) {
        const {id, remark} = app;

        if (!id || !remark || remark.trim().length === 0) {
          errors.push({
            id: id || "unknown",
            error: "ID and remark are required",
          });
          continue;
        }

        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          if (application.status !== "draft") {
            errors.push({id, error: "Can only reject draft applications"});
            continue;
          }

          await this.sessionService.rejectApplication(
            id,
            remark.trim(),
            name,
            initial,
            partner_name
          );

          try {
            await this.sendTelegramNotification(
              application.telegram_id,
              "rejected",
              {
                remark: remark.trim(),
              },
              req.partnerId as number
            );
          } catch (telegramError) {
            this.logger.error(
              `Telegram notification failed for ID ${id}:`,
              telegramError
            );
          }

          results.push({
            id,
            status: "rejected",
            remark: remark.trim(),
            rejected_by: name,
            rejected_at: new Date(),
          });
        } catch (error) {
          this.logger.error(`Error rejecting application ID ${id}:`, error);
          errors.push({id, error: "Rejection failed"});
        }
      }

      res.json({
        success: true,
        message: `Rejected ${results.length} applications, ${errors.length} errors`,
        data: {
          results,
          errors,
          processed_by: {
            name,
            initial,
            partner_name,
            processed_at: new Date(),
          },
        },
      });
    } catch (error) {
      this.logger.error("Error in bulk reject:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process bulk rejection",
      });
    }
  };

  public servePdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const {id} = req.params;

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );
      if (!application || !application.pdf_url) {
        res.status(404).json({
          success: false,
          message: "PDF not found",
        });
        return;
      }

      const fileName = path.basename(application.pdf_url);
      const filePath = path.join(
        process.env.PDF_OUTPUT_PATH || "public/pdfs",
        fileName
      );

      if (!(await fs.pathExists(filePath))) {
        res.status(404).json({
          success: false,
          message: "PDF file not found",
        });
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      this.logger.error("Error serving PDF:", error);
      res.status(500).json({
        success: false,
        message: "Failed to serve PDF",
      });
    }
  };
  public stampWithEmeterai = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {stamped_by} = req.body;
      const partnerId = req.partnerId!;

      if (!stamped_by) {
        res
          .status(400)
          .json({success: false, message: "stamped_by is required"});
        return;
      }

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );
      if (!application) {
        res
          .status(404)
          .json({success: false, message: "Application not found"});
        return;
      }

      if (application.status !== "confirmed") {
        res.status(400).json({
          success: false,
          message: "Can only stamp confirmed applications",
        });
        return;
      }

      if (!application.pdf_url) {
        res.status(400).json({
          success: false,
          message: "Can only stamp exported pdf",
        });
        return;
      }

      if (application.emeterai_status === "completed") {
        res
          .status(400)
          .json({success: false, message: "Application already stamped"});
        return;
      }

      const emeteraiService = new EmeteraiService();
      await emeteraiService.processStamping(
        parseInt(id),
        stamped_by,
        partnerId
      );

      res.json({
        success: true,
        message: "E-meterai stamping completed successfully",
        data: {id: parseInt(id), emeterai_status: "completed"},
      });
    } catch (error) {
      this.logger.error("Error stamping with E-meterai:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stamp with E-meterai",
      });
    }
  };

  public downloadStampedPdf = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const {id} = req.params;

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );
      if (!application || !application.stamped_pdf_url) {
        res
          .status(404)
          .json({success: false, message: "Stamped PDF not found"});
        return;
      }

      if (application.emeterai_status !== "completed") {
        res
          .status(400)
          .json({success: false, message: "E-meterai process not completed"});
        return;
      }

      res.redirect(application.stamped_pdf_url);
    } catch (error) {
      this.logger.error("Error downloading stamped PDF:", error);
      res
        .status(500)
        .json({success: false, message: "Failed to download stamped PDF"});
    }
  };

  public bulkStampWithEmeterai = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {applications} = req.body;
      const partnerId = req.partnerId!;

      if (!Array.isArray(applications) || applications.length === 0) {
        res.status(400).json({
          success: false,
          message: "Applications array is required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const app of applications) {
        const {id, stamped_by} = app;

        if (!id || !stamped_by) {
          errors.push({
            id: id || "unknown",
            error: "ID and stamped_by are required",
          });
          continue;
        }

        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          if (application.status !== "confirmed") {
            errors.push({id, error: "Application not confirmed"});
            continue;
          }

          if (application.emeterai_status === "completed") {
            results.push({
              id,
              status: "already_stamped",
              stamped_pdf_url: application.stamped_pdf_url,
            });
            continue;
          }

          this.processStampingAsync(id, stamped_by, partnerId);

          results.push({
            id,
            status: "processing",
            emeterai_status: "getting_token",
          });
        } catch (error) {
          this.logger.error(`Error processing stamping for ID ${id}:`, error);
          errors.push({id, error: "Stamping process failed"});
        }
      }

      res.json({
        success: true,
        message: `Initiated stamping for ${results.length} applications, ${errors.length} errors`,
        data: {
          results,
          errors,
        },
      });
    } catch (error) {
      this.logger.error("Error in bulk E-meterai stamping:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process bulk E-meterai stamping",
      });
    }
  };

  private async processStampingAsync(
    applicationId: number,
    stampedBy: string,
    partnerId: number
  ): Promise<void> {
    try {
      const emeteraiService = new EmeteraiService();
      await emeteraiService.processStamping(
        applicationId,
        stampedBy,
        partnerId
      );

      this.logger.info("Background stamping completed", {applicationId});
    } catch (error) {
      this.logger.error("Background stamping failed", {applicationId, error});
      await this.sessionService.updateEmeteraiStatus(applicationId, "failed");
    }
  }

  public bulkDownloadStampedPdf = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {ids} = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array is required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          if (
            application.emeterai_status !== "completed" ||
            !application.stamped_pdf_url
          ) {
            errors.push({id, error: "Stamped PDF not available"});
            continue;
          }

          results.push({
            id,
            stamped_pdf_url: application.stamped_pdf_url,
            stamped_by: application.stamped_by,
            stamped_at: application.stamped_at,
          });
        } catch (error) {
          this.logger.error(`Error getting stamped PDF for ID ${id}:`, error);
          errors.push({id, error: "Failed to get stamped PDF info"});
        }
      }

      res.json({
        success: true,
        message: `Retrieved ${results.length} stamped PDFs, ${errors.length} errors`,
        data: {
          results,
          errors,
        },
      });
    } catch (error) {
      this.logger.error("Error in bulk stamped PDF download:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process bulk stamped PDF download",
      });
    }
  };

  public getBulkEmeteraiStatus = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {ids} = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array is required",
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          const application = await this.sessionService.getKYCApplicationById(
            id
          );

          if (!application) {
            errors.push({id, error: "Application not found"});
            continue;
          }

          results.push({
            id,
            emeterai_status: application.emeterai_status || "not_started",
            emeterai_transaction_id: application.emeterai_transaction_id,
            stamped_pdf_url: application.stamped_pdf_url,
            stamped_by: application.stamped_by,
            stamped_at: application.stamped_at,
          });
        } catch (error) {
          this.logger.error(
            `Error getting E-meterai status for ID ${id}:`,
            error
          );
          errors.push({id, error: "Failed to get status"});
        }
      }

      res.json({
        success: true,
        message: `Retrieved status for ${results.length} applications, ${errors.length} errors`,
        data: {
          results,
          errors,
        },
      });
    } catch (error) {
      this.logger.error("Error getting bulk E-meterai status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get bulk E-meterai status",
      });
    }
  };

  public getProcessingProgress = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const result = await this.sessionService.db.query(`
      SELECT 
        emeterai_status,
        COUNT(*) as count
      FROM kyc_applications 
      WHERE status = 'confirmed'
      GROUP BY emeterai_status
    `);

      const progressSummary = {
        not_started: 0,
        getting_token: 0,
        converting_pdf: 0,
        uploading_document: 0,
        generating_sn: 0,
        stamping: 0,
        downloading: 0,
        completed: 0,
        failed: 0,
      };

      result.rows.forEach((row: any) => {
        progressSummary[row.emeterai_status as keyof typeof progressSummary] =
          parseInt(row.count);
      });

      res.json({
        success: true,
        data: progressSummary,
      });
    } catch (error) {
      this.logger.error("Error getting processing progress:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get processing progress",
      });
    }
  };

  private async sendTelegramNotification(
    telegramId: number,
    type: "confirmed" | "rejected",
    data: any,
    partnerId: number
  ): Promise<void> {
    try {
      console.log("Sending Telegram notification:", {
        telegramId,
        type,
        partnerId,
      });

      const partnerResult = await this.sessionService.db.query(
        "SELECT bot_token FROM bot_partners WHERE id = $1",
        [partnerId]
      );

      if (partnerResult.rows.length === 0) {
        throw new Error(`Partner ${partnerId} not found`);
      }

      const botToken = partnerResult.rows[0].bot_token;
      const bot = new TelegramBot(botToken, {
        polling: false,
      });

      const messageTemplates = new MessageTemplates();

      if (type === "confirmed") {
        const message = messageTemplates.generateEmeteraiConsentMessage(
          data.application,
          data.pdfUrl
        );

        await bot.sendMessage(telegramId, message, {
          parse_mode: "Markdown",
        });
      } else if (type === "rejected") {
        const message = `❌ Aplikasi KYC Anda telah ditolak.

📝 Alasan: ${data.remark}

Anda dapat mendaftar ulang dengan data yang benar menggunakan /daftar`;

        const result = await bot.sendMessage(telegramId, message);
        console.log("Telegram rejection message sent successfully:", result);
      }
    } catch (error: any) {
      this.logger.error("Error sending Telegram notification:", {
        telegramId,
        type,
        partnerId,
        error: error.message,
        stack: error.stack,
      });
      console.error("Detailed Telegram error:", error);
      throw error;
    }
  }

  public updateProcessedStatus = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {is_processed} = req.body;
      const partnerId = req.partnerId!;

      if (typeof is_processed !== "boolean") {
        res.status(400).json({
          success: false,
          message: "is_processed must be a boolean value",
        });
        return;
      }

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );
      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      await this.sessionService.updateProcessedStatus(
        parseInt(id),
        is_processed,
        partnerId
      );

      res.json({
        success: true,
        message: "Processed status updated successfully",
        data: {
          id: parseInt(id),
          is_processed,
        },
      });
    } catch (error) {
      this.logger.error("Error updating processed status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update processed status",
      });
    }
  };

  public exportExcel = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const partnerId = req.partnerId!;

      const applications = await this.sessionService.getAllKYCApplications(
        partnerId
      );

      const confirmedApplications: any[] = applications.filter(
        (app) => app.status === "confirmed"
      );

      if (confirmedApplications.length === 0) {
        res.status(400).json({
          success: false,
          message: "No confirmed applications to export",
        });
        return;
      }

      const excelUrl = await this.excelExportService.exportToExcel(
        confirmedApplications
      );

      res.json({
        success: true,
        message: "Excel export completed successfully",
        data: {
          excel_url: excelUrl,
          record_count: confirmedApplications.length,
          export_date: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error("Error exporting Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export Excel file",
      });
    }
  };

  public updateArtajasaReview = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {is_reviewed} = req.body;

      if (typeof is_reviewed !== "boolean") {
        res.status(400).json({
          success: false,
          message: "is_reviewed must be a boolean value",
        });
        return;
      }

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );

      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      await this.sessionService.updateArtajasaReview(parseInt(id), is_reviewed);

      res.json({
        success: true,
        message: "Artajasa review status updated successfully",
        data: {
          id: parseInt(id),
          is_reviewed_by_artajasa: is_reviewed,
        },
      });
    } catch (error) {
      this.logger.error("Error updating Artajasa review status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update Artajasa review status",
      });
    }
  };

  public updateEmeteraiConsent = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {consent} = req.body;

      if (typeof consent !== "boolean") {
        res.status(400).json({
          success: false,
          message: "consent must be a boolean value",
        });
        return;
      }

      await this.sessionService.updateEmeteraiConsent(parseInt(id), consent);

      res.json({
        success: true,
        message: "E-meterai consent updated successfully",
        data: {
          id: parseInt(id),
          user_emeterai_consent: consent,
        },
      });
    } catch (error) {
      this.logger.error("Error updating e-meterai consent:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update e-meterai consent",
      });
    }
  };

  public getEmeteraiStatus = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );

      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: application.id,
          emeterai_status: application.emeterai_status,
          emeterai_transaction_id: application.emeterai_transaction_id,
          emeterai_sn: application.emeterai_sn,
          stamped_pdf_url: application.stamped_pdf_url,
          stamped_by: application.stamped_by,
          stamped_at: application.stamped_at,
          user_emeterai_consent: application.user_emeterai_consent,
        },
      });
    } catch (error) {
      this.logger.error("Error getting e-meterai status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get e-meterai status",
      });
    }
  };

  public getById = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;

      const application = await this.sessionService.getKYCApplicationById(
        parseInt(id)
      );

      if (!application) {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
        return;
      }

      const photos = await this.sessionService.getApplicationPhotos(
        parseInt(id)
      );

      res.json({
        success: true,
        data: {
          application,
          photos,
        },
      });
    } catch (error) {
      this.logger.error("Error getting application:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get application",
      });
    }
  };

  public bulkExportExcel = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {applicationIds} = req.body;
      const partnerId = req.partnerId!;

      let applications: any[];

      if (applicationIds && Array.isArray(applicationIds)) {
        applications = [];
        for (const id of applicationIds) {
          const app = await this.sessionService.getKYCApplicationById(id);
          if (app && app.status === "confirmed") {
            applications.push(app);
          }
        }
      } else {
        const allApplications = await this.sessionService.getAllKYCApplications(
          partnerId
        );
        applications = allApplications.filter(
          (app) => app.status === "confirmed"
        );
      }

      if (applications.length === 0) {
        res.status(400).json({
          success: false,
          message: "No confirmed applications to export",
        });
        return;
      }

      const excelUrl = await this.excelExportService.exportToExcel(
        applications
      );

      res.json({
        success: true,
        message: "Excel export completed successfully",
        data: {
          excel_url: excelUrl,
          record_count: applications.length,
          export_date: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error("Error exporting Excel:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export Excel file",
      });
    }
  };

  public getAllConfirmedAndStamped = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const applications =
        await this.sessionService.getAllConfirmedAndStamped();

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      this.logger.error("Error getting KYC list:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  public processStampedForArtajasa = async (
    req: AuthRequest,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const artajasaService = new ArtajasaService();
      const result = await artajasaService.processStampedApplications();

      res.json({
        success: true,
        message: `Processed ${result.processedCount} applications for Artajasa`,
        data: result,
      });
    } catch (error) {
      this.logger.error("Error processing for Artajasa:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process applications for Artajasa",
      });
    }
  };
}

export const kycController = new KYCController();
