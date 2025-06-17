import {CacheProvider} from "./CacheProvider";

export class InMemoryCache implements CacheProvider {
  private cache = new Map<string, {value: any; expires?: number}>();
  private locks = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);

    if (!item) return null;

    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, {value, expires});
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.locks.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async increment(key: string, ttl?: number): Promise<number> {
    const existing = await this.get<number>(key);
    const newValue = (existing || 0) + 1;
    await this.set(key, newValue, ttl);
    return newValue;
  }

  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const now = Date.now();
    const lockExpiry = this.locks.get(key);

    if (lockExpiry && lockExpiry > now) {
      return false;
    }

    this.locks.set(key, now + ttl * 1000);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.locks.clear();
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.expires && item.expires < now) {
        this.cache.delete(key);
      }
    }

    for (const [key, expires] of this.locks.entries()) {
      if (expires < now) {
        this.locks.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}
