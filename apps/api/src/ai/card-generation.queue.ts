import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import type { AiJobView } from "@taskora/shared";
import { AiJobStatus } from "@taskora/shared";
import { AiService } from "./ai.service";

const QUEUE_NAME = "card-generation";

function connection() {
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
}

/**
 * Background job لتوليد الكارت بالـ AI — عشان الطلب الأصلي مايستناش
 * استجابة الـ Claude API (ممكن تاخد ثواني). النتيجة بتتجاب بالـ polling.
 */
@Injectable()
export class CardGenerationQueue implements OnModuleDestroy {
  private readonly queue = new Queue(QUEUE_NAME, { connection: connection() });
  private worker: Worker;

  constructor(private readonly ai: AiService) {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<{ prompt: string }>) => this.ai.generateCardDraft(job.data.prompt),
      { connection: connection() },
    );
  }

  async enqueue(prompt: string): Promise<{ jobId: string }> {
    const job = await this.queue.add("generate", { prompt });
    return { jobId: job.id! };
  }

  async getStatus(jobId: string): Promise<AiJobView> {
    const job = await this.queue.getJob(jobId);
    if (!job) return { jobId, status: AiJobStatus.Failed, error: "Job غير موجود" };

    const state = await job.getState();
    if (state === "completed") {
      return { jobId, status: AiJobStatus.Completed, result: job.returnvalue };
    }
    if (state === "failed") {
      return { jobId, status: AiJobStatus.Failed, error: job.failedReason };
    }
    return { jobId, status: AiJobStatus.Pending };
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }
}
