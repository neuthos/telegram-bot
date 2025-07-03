import {Router} from "express";
import {authMiddleware} from "../middleware/authMiddleware";
import {kycController} from "../controllers/kycController";

const router = Router();

router.post("/process-artajasa", kycController.processStampedForArtajasa);

router.use(authMiddleware);

router.get("/list", kycController.getList);

router.post("/bulk/export-pdf", kycController.bulkExportPdf);
router.post("/bulk/confirm", kycController.bulkConfirmApplications);
router.post("/bulk/reject", kycController.bulkRejectApplications);
router.post("/:id/confirm", kycController.confirmApplication);

router.post("/:id/export-pdf", kycController.exportPdf);
router.post("/:id/reject", kycController.rejectApplication);

router.get("/:id/pdf", kycController.servePdf);

router.post("/:id/stamp-emeterai", kycController.stampWithEmeterai);
router.get("/:id/stamped-pdf", kycController.downloadStampedPdf);
router.get("/:id/emeterai-status", kycController.getEmeteraiStatus);

router.get("/processing-progress", kycController.getProcessingProgress);

router.put("/:id/processed-status", kycController.updateProcessedStatus);

router.get("/:id", kycController.getById);
router.post("/bulk/export-excel", kycController.bulkExportExcel);
router.put("/:id/artajasa-review", kycController.updateArtajasaReview);
router.put("/:id/emeterai-consent", kycController.updateEmeteraiConsent);
router.post("/bulk/emeterai-status", kycController.getBulkEmeteraiStatus);

export default router;
