import Bull from "bull";
import {InMemoryQueue} from "./InMemoryQueue";

export class QueueFactory {
  static create<T>(name: string, concurrency?: number) {
    if (process.env.REDIS_URL) {
      return new Bull(name, process.env.REDIS_URL);
    }
    return new InMemoryQueue<T>(name, concurrency);
  }
}
