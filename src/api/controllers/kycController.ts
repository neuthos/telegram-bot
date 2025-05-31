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

      if (application.status !== "draft") {
        res.status(400).json({
          success: false,
          message: "Can only export draft applications",
        });
        return;
      }

      const photos = await this.sessionService.getApplicationPhotos(
        parseInt(id)
      );
      const fileName = await this.pdfService.generateKYCPDF(
        application,
        photos
      );

      const pdfUrl = `${process.env.BASE_URL}/pdfs/${fileName}`;

      // Update application status to confirmed and add PDF URL
      await this.sessionService.updateApplicationStatus(
        parseInt(id),
        "confirmed",
        pdfUrl
      );

      res.json({
        success: true,
        message: "PDF generated and application confirmed",
        data: {
          pdf_url: pdfUrl,
          status: "confirmed",
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
