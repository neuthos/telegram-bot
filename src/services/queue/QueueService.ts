import {InMemoryQueue} from "./InMemoryQueue";
import {Logger} from "../../config/logger";
import {CacheProvider} from "../cache/CacheProvider";
import {CacheFactory} from "../cache/CacheFactory";

interface MessageJob {
  partnerId: number;
  message: any;
  timestamp: number;
}

export class QueueService {
  private queues: Map<number, InMemoryQueue<MessageJob>> = new Map();
  private cache: CacheProvider;
  private logger = Logger.getInstance();

  constructor() {
    this.cache = CacheFactory.create();
  }

  getOrCreateQueue(
    partnerId: number,
    concurrency?: number
  ): InMemoryQueue<MessageJob> {
    if (!this.queues.has(partnerId)) {
      const queue = new InMemoryQueue<MessageJob>(
        `partner-${partnerId}`,
        concurrency || 10
      );
      this.queues.set(partnerId, queue);
    }
    return this.queues.get(partnerId)!;
  }

  async addMessageJob(partnerId: number, message: any): Promise<void> {
    const messageKey = `msg:${partnerId}:${message.from.id}:${message.message_id}`;
    const exists = await this.cache.exists(messageKey);

    if (exists) return;

    await this.cache.set(messageKey, "1", 60);

    const queue = this.getOrCreateQueue(partnerId);
    await queue.add({
      partnerId,
      message,
      timestamp: Date.now(),
    });
  }

  async closeAll(): Promise<void> {
    this.queues.clear();
  }
}
