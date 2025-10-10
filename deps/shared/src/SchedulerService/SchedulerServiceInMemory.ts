import { Cron } from "croner";

import type { Logger } from "~shared/Logger";

import type { SchedulerService } from "./SchedulerService";

export class SchedulerServiceInMemory implements SchedulerService {
  private readonly logger: Logger;
  private readonly jobs: Record<string, Cron> = {};

  constructor(logger: Logger) {
    this.logger = logger.extend("SchedulerServiceInMemory");
  }

  schedule(
    id: string,
    cronExpression: string,
    handler: () => Promise<void> | void
  ): void {
    const logger = this.logger.extend("register", { id, cronExpression });
    if (this.jobs[id]) {
      logger.warn("已存在同名排程任務，將覆蓋舊任務");
      this.jobs[id].stop();
    }

    const job = new Cron(cronExpression, async () => {
      const logger = this.logger.extend(`run`, {
        id,
      });
      logger.info("執行排程任務");
      try {
        await handler();
        logger.info("排程任務執行成功");
      } catch (error) {
        logger.error(
          {
            error,
          },
          "排程任務執行失敗"
        );
      }
    });
    const nextRun = job.nextRun();

    if (!nextRun) {
      this.logger.warn(`Cron 表達式 "${cronExpression}" 無效，無法啟動任務`);
    }

    this.jobs[id] = job;
    logger.info()`已註冊排程任務 ${id}，下一次執行時間: ${nextRun}`;
  }

  [Symbol.dispose]() {
    this.logger.info("釋放 CronService 資源");
    for (const [id, job] of Object.entries(this.jobs)) {
      this.logger.info(`停止排程任務: ${id}`);
      job.stop();
    }
  }
}
