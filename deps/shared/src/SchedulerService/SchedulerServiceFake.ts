import type { SchedulerService } from "~shared/SchedulerService";
import type { MaybePromise } from "~shared/utils/TypeHelper";

type ScheduledJob = {
  id: string;
  cronExpression: string;
  handler: () => MaybePromise<void>;
};

export class SchedulerServiceFake implements SchedulerService {
  private readonly jobs: Map<string, ScheduledJob> = new Map();

  schedule(
    id: string,
    cronExpression: string,
    handler: () => MaybePromise<void>
  ): void {
    this.jobs.set(id, {
      id,
      cronExpression,
      handler,
    });
  }

  /**
   * 手動執行排程任務。
   * 若傳入 `id`，只執行該任務；否則執行所有已註冊任務。
   */
  async run(id?: string): Promise<void> {
    if (id) {
      const job = this.jobs.get(id);
      if (!job) throw new Error(`找不到排程任務：${id}`);
      await job.handler();
    } else {
      for (const job of this.jobs.values()) {
        await job.handler();
      }
    }
  }

  listJobs(): ScheduledJob[] {
    return [...this.jobs.values()];
  }
}
