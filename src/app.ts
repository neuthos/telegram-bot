import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {BotManager} from "./services/BotManager";
import {Logger} from "./config/logger";
import kycRoutes from "./api/routes/kycRoutes";
import fs from "fs-extra";

dotenv.config();

const logger = Logger.getInstance();
const botManager = new BotManager();

async function initializeApp() {
  await fs.ensureDir("logs");
  await fs.ensureDir(process.env.UPLOAD_PATH || "uploads/kyc");
  await fs.ensureDir(process.env.PDF_OUTPUT_PATH || "public/pdfs");

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/kyc", kycRoutes);
  app.use(
    "/pdfs",
    express.static(process.env.PDF_OUTPUT_PATH || "public/pdfs")
  );

  const API_PORT = process.env.API_PORT || 3000;
  app.listen(API_PORT, () => {
    logger.info(`API Server running on port ${API_PORT}`);
  });

  await botManager.initialize();

  process.on("SIGINT", async () => {
    logger.info("Shutting down gracefully");
    await botManager.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down");
    await botManager.shutdown();
    process.exit(0);
  });
}

initializeApp().catch((error) => {
  logger.error("Failed to initialize app:", error);
  process.exit(1);
});
