import dotenv from "dotenv";
import {KYCBot} from "./KYCBot";
import {Logger} from "./config/logger";
import fs from "fs-extra";

dotenv.config();

const logger = Logger.getInstance();

async function initializeBot() {
  if (!process.env.BOT_TOKEN) {
    logger.error("BOT_TOKEN is required");
    process.exit(1);
  }

  try {
    await fs.ensureDir("logs");
    await fs.ensureDir(process.env.UPLOAD_PATH || "uploads/kyc");
    logger.info("Required directories created/verified");
  } catch (error) {
    logger.error("Failed to create required directories:", error);
    process.exit(1);
  }

  const bot = new KYCBot(process.env.BOT_TOKEN);

  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully");
    await bot.stop();
    process.exit(0);
  });

  bot.start();
}

initializeBot().catch((error) => {
  logger.error("Failed to initialize bot:", error);
  process.exit(1);
});
