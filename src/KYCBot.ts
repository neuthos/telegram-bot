import TelegramBot from "node-telegram-bot-api";
import {MessageHandler} from "./handlers/MessageHandler";
import {Logger} from "./config/logger";
import {Database} from "./config/database";

export class KYCBot {
  private bot: TelegramBot;
  private messageHandler: MessageHandler;
  private logger = Logger.getInstance();

  constructor(token: string) {
    this.bot = new TelegramBot(token, {polling: true});
    this.messageHandler = new MessageHandler();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on("message", async (msg) => {
      await this.messageHandler.handleMessage(this.bot, msg);
    });

    this.bot.on("polling_error", (error) => {
      this.logger.error("Polling error:", error);
    });

    this.bot.on("error", (error) => {
      this.logger.error("Bot error:", error);
    });
  }

  public start(): void {
    this.logger.info("KYC Bot started successfully");
    console.log("KYC Bot is running...");
  }

  public async stop(): Promise<void> {
    await this.bot.stopPolling();
    await Database.getInstance().close();
    this.logger.info("KYC Bot stopped");
  }
}
