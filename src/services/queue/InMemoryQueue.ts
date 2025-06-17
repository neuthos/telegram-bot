export interface QueueJob<T = any> {
  id: string;
  data: T;
  attempts: number;
  timestamp: number;
  status: "waiting" | "active" | "completed" | "failed";
}

export class InMemoryQueue<T> {
  private jobs: Map<string, QueueJob<T>> = new Map();
  private waiting: string[] = [];
  private processing = new Set<string>();
  private concurrency: number;
  private processor?: (job: QueueJob<T>) => Promise<void>;

  constructor(name: string, concurrency = 5) {
    this.concurrency = concurrency;
  }

  async add(data: T): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const job: QueueJob<T> = {
      id,
      data,
      attempts: 0,
      timestamp: Date.now(),
      status: "waiting",
    };

    this.jobs.set(id, job);
    this.waiting.push(id);

    setImmediate(() => this.processNext());
    return id;
  }

  process(processor: (job: QueueJob<T>) => Promise<void>): void {
    this.processor = processor;
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (!this.processor) return;
    if (this.processing.size >= this.concurrency) return;
    if (this.waiting.length === 0) return;

    const jobId = this.waiting.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    this.processing.add(jobId);
    job.status = "active";

    try {
      await this.processor(job);
      job.status = "completed";
      this.jobs.delete(jobId);
    } catch (error) {
      job.attempts++;
      job.status = "waiting";

      if (job.attempts < 3) {
        setTimeout(() => {
          this.waiting.push(jobId);
          this.processNext();
        }, Math.pow(2, job.attempts) * 1000);
      } else {
        job.status = "failed";
      }
    } finally {
      this.processing.delete(jobId);
      this.processNext();
    }
  }
}
