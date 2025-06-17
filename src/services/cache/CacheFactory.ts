import {CacheProvider} from "./CacheProvider";
import {InMemoryCache} from "./InMemoryCache";
import {RedisCache} from "./RedisCache";

export class CacheFactory {
  static create(): CacheProvider {
    if (process.env.REDIS_URL) {
      return new RedisCache(process.env.REDIS_URL);
    }

    return new InMemoryCache();
  }
}
