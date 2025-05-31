// src/app.ts
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {KYCBot} from "./KYCBot";
import {Logger} from "./config/logger";
import kycRoutes from "./api/routes/kycRoutes";
import fs from "fs-extra";

dotenv.config();

const logger = Logger.getInstance();

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

  if (!process.env.BOT_TOKEN) {
    logger.error("BOT_TOKEN is required");
    process.exit(1);
  }

  const bot = new KYCBot(process.env.BOT_TOKEN);
  bot.start();

  process.on("SIGINT", async () => {
    logger.info("Shutting down gracefully");
    await bot.stop();
    process.exit(0);
  });
}

initializeApp().catch((error) => {
  logger.error("Failed to initialize app:", error);
  process.exit(1);
});
