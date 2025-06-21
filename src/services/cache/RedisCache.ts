import Redis from "ioredis";
import {CacheProvider} from "./CacheProvider";

export class RedisCache implements CacheProvider {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async increment(key: string, ttl?: number): Promise<number> {
    const result = await this.client.incr(key);
    if (ttl && result === 1) {
      await this.client.expire(key, ttl);
    }
    return result;
  }

  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.set(key, "1", "EX", ttl, "NX");
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
