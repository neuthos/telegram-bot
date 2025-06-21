// src/services/queue/MessageProcessor.ts
import {QueueJob} from "./InMemoryQueue";
import {MessageHandler} from "../../handlers/MessageHandler";
import {Logger} from "../../config/logger";
import {CacheProvider} from "../cache/CacheProvider";
import {CacheFactory} from "../cache/CacheFactory";

export class MessageProcessor {
  private messageHandler: MessageHandler | undefined;
  private cache: CacheProvider;
  private logger = Logger.getInstance();
  private bots: Map<number, any> = new Map();

  constructor() {
    this.cache = CacheFactory.create();
  }

  registerBot(partnerId: number, bot: any): void {
    this.bots.set(partnerId, bot);
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async processMessage(job: QueueJob<any>): Promise<void> {
    const {partnerId, message} = job.data;
    const lockKey = `process:${partnerId}:${message.from.id}`;

    const acquired = await this.cache.acquireLock(lockKey, 30);
    if (!acquired) {
      throw new Error("Failed to acquire lock");
    }

    try {
      const bot = this.bots.get(partnerId);
      if (!bot) {
        throw new Error(`Bot not found for partner ${partnerId}`);
      }

      await this.messageHandler?.handleMessage(bot, message, partnerId);
    } catch (error) {
      this.logger.error("Message processing failed", {
        partnerId,
        userId: message.from.id,
        error,
      });
      throw error;
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }
}
