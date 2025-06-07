// src/api/controllers/kycController.ts
import {Request, Response} from "express";
import {ApiResponse} from "../middleware/authMiddleware";
import {SessionService} from "../../services/SessionServices";
import {PDFService} from "../../services/PdfService";
import {Logger} from "../../config/logger";
import path from "path";
import fs from "fs-extra";

export class KYCController {
  private sessionService = new SessionService();
  private pdfService = new PDFService();
  private logger = Logger.getInstance();

  public getList = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const applications = await this.sessionService.getAllKYCApplications();

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

  // 1. Export PDF hanya untuk yang sudah confirmed
  public exportPdf = async (
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

      if (application.status !== "confirmed") {
        res.status(400).json({
          success: false,
          message: "Can only export confirmed applications",
        });
        return;
      }

      // Jika sudah ada PDF, return existing URL
      if (application.pdf_url) {
        res.json({
          success: true,
          message: "PDF already exists",
          data: {
            pdf_url: application.pdf_url,
            status: application.status,
          },
        });
        return;
      }

      const photos = await this.sessionService.getApplicationPhotos(
        parseInt(id)
      );
      const pdfUrl = await this.pdfService.generateKYCPDF(application, photos);

      // Update PDF URL tanpa mengubah status
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

  // 2. Bulk Export PDF
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

          // Skip jika PDF sudah ada
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

  // 3. Confirm Applications
  public confirmApplication = async (
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

      if (application.status !== "draft") {
        res.status(400).json({
          success: false,
          message: "Can only confirm draft applications",
        });
        return;
      }

      await this.sessionService.updateApplicationStatus(
        parseInt(id),
        "confirmed"
      );

      res.json({
        success: true,
        message: "Application confirmed successfully",
        data: {
          id: parseInt(id),
          status: "confirmed",
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

  // 4. Bulk Confirm Applications
  public bulkConfirmApplications = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {ids} = req.body;
      console.log({ids});
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

          if (application.status !== "draft") {
            errors.push({id, error: "Application not in draft status"});
            continue;
          }

          await this.sessionService.updateApplicationStatus(id, "confirmed");
          results.push({id, status: "confirmed"});
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

  // 5. Reject Application
  public rejectApplication = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {id} = req.params;
      const {remark} = req.body;

      if (!remark || remark.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Remark is required",
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

      await this.sessionService.rejectApplication(parseInt(id), remark.trim());

      res.json({
        success: true,
        message: "Application rejected successfully",
        data: {
          id: parseInt(id),
          status: "rejected",
          remark: remark.trim(),
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

  // 6. Bulk Reject Applications
  public bulkRejectApplications = async (
    req: Request,
    res: Response<ApiResponse>
  ): Promise<void> => {
    try {
      const {applications} = req.body;

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
            errors.push({id, error: "Application not in draft status"});
            continue;
          }

          await this.sessionService.rejectApplication(id, remark.trim());
          results.push({id, status: "rejected", remark: remark.trim()});
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
}

export const kycController = new KYCController();
