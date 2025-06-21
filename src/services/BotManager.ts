// src/services/BotManager.ts
import TelegramBot from "node-telegram-bot-api";
import {Database} from "../config/database";
import {Logger} from "../config/logger";
import {QueueService} from "./queue/QueueService";
import {MessageProcessor} from "./queue/MessageProcessor";
import {MessageHandler} from "../handlers/MessageHandler";
import {Partner} from "../types";

export class BotManager {
  private bots: Map<number, TelegramBot> = new Map();
  private queueService: QueueService;
  private messageProcessor: MessageProcessor;
  private messageHandler = new MessageHandler();
  private logger = Logger.getInstance();
  private db = Database.getInstance().getPool();
  private instanceId = `bot-${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}`;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    this.queueService = new QueueService();
    this.messageProcessor = new MessageProcessor();
  }

  async initialize(): Promise<void> {
    this.messageProcessor.setMessageHandler(this.messageHandler);
    const partners = await this.getActivePartners();

    for (const partner of partners) {
      await this.initializeBot(partner);
    }

    this.startHeartbeat();
    this.setupWorkers();
  }

  private async initializeBot(partner: Partner): Promise<void> {
    try {
      const bot = new TelegramBot(partner.bot_token, {
        polling: {
          interval: 300,
          params: {
            timeout: 30,
            allowed_updates: ["message"],
          },
        },
      });

      bot.on("message", async (msg) => {
        await this.queueService.addMessageJob(partner.id, msg);
      });

      bot.on("polling_error", (error) => {
        this.logger.error(
          `Bot polling error for partner ${partner.id}:`,
          error
        );
      });

      this.bots.set(partner.id, bot);
      this.messageProcessor.registerBot(partner.id, bot);

      await this.registerInstance(partner.id);

      this.logger.info(
        `Bot initialized for partner ${partner.name} (ID: ${partner.id})`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize bot for partner ${partner.id}:`,
        error
      );
    }
  }

  private async setupWorkers(): Promise<void> {
    const partners = await this.getActivePartners();

    for (const partner of partners) {
      const queue = this.queueService.getOrCreateQueue(
        partner.id,
        partner.rate_limit
      );

      queue.process(async (job) => {
        await this.messageProcessor.processMessage(job);
      });
    }
  }

  private async getActivePartners(): Promise<Partner[]> {
    const result = await this.db.query(
      "SELECT * FROM partners WHERE is_active = true ORDER BY id"
    );
    return result.rows;
  }

  private async registerInstance(partnerId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO bot_instances (partner_id, instance_id, hostname, status, last_heartbeat)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
       ON CONFLICT (instance_id) DO UPDATE
       SET last_heartbeat = CURRENT_TIMESTAMP, status = 'active'`,
      [partnerId, this.instanceId, require("os").hostname()]
    );
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      for (const partnerId of this.bots.keys()) {
        await this.registerInstance(partnerId);
      }
    }, 30000);
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await this.db.query(
      "UPDATE bot_instances SET status = 'inactive' WHERE instance_id = $1",
      [this.instanceId]
    );

    for (const bot of this.bots.values()) {
      await bot.stopPolling();
    }

    await this.queueService.closeAll();
    this.logger.info("BotManager shutdown complete");
  }
}
