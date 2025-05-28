import dotenv from "dotenv";
import {KYCBot} from "./KYCBot";
import {Logger} from "./config/logger";

dotenv.config();

const logger = Logger.getInstance();

if (!process.env.BOT_TOKEN) {
  logger.error("BOT_TOKEN is required");
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
