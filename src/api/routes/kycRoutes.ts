// src/api/routes/kycRoutes.ts
import {Router} from "express";
import {authMiddleware} from "../middleware/authMiddleware";
import {kycController} from "../controllers/kycController";

const router = Router();

router.use(authMiddleware);

router.get("/list", kycController.getList);

// Single operations

// Bulk operations
router.post("/bulk/export-pdf", kycController.bulkExportPdf);
router.post("/bulk/confirm", kycController.bulkConfirmApplications);
router.post("/bulk/reject", kycController.bulkRejectApplications);

router.post("/:id/export-pdf", kycController.exportPdf);
router.post("/:id/confirm", kycController.confirmApplication);
router.post("/:id/reject", kycController.rejectApplication);

// PDF serving
router.get("/:id/pdf", kycController.servePdf);

router.post("/:id/stamp-emeterai", kycController.stampWithEmeterai);
router.get("/:id/stamped-pdf", kycController.downloadStampedPdf);
router.get("/:id/emeterai-status", kycController.getEmeteraiStatus);

// Tambah routes baru:
router.post("/:id/stamp-emeterai", kycController.stampWithEmeterai);
router.get("/:id/stamped-pdf", kycController.downloadStampedPdf);
router.get("/:id/emeterai-status", kycController.getEmeteraiStatus);

// Single operations E-meterai
router.post("/:id/stamp-emeterai", kycController.stampWithEmeterai);
router.get("/:id/stamped-pdf", kycController.downloadStampedPdf);
router.get("/:id/emeterai-status", kycController.getEmeteraiStatus);

// Tambah di kycRoutes.ts
router.get("/processing-progress", kycController.getProcessingProgress);
export default router;
