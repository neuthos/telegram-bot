// src/api/routes/kycRoutes.ts
import {Router} from "express";
import {authMiddleware} from "../middleware/authMiddleware";
import {kycController} from "../controllers/kycController";

const router = Router();

router.use(authMiddleware);

router.get("/list", kycController.getList);

router.post("/:id/export-pdf", kycController.exportPdf);

router.post("/:id/reject", kycController.rejectApplication);

router.get("/:id/pdf", kycController.servePdf);

export default router;
