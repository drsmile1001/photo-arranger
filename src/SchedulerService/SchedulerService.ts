import type { MaybePromise } from "~shared/utils/TypeHelper";

export interface SchedulerService {
  /**
   * 註冊一個定時任務。
   *
   * @param id 任務名稱（用於紀錄與錯誤追蹤）
   * @param cronExpression Cron 格式字串，例如 "0 0 * * *"
   * @param handler 執行的邏輯，可為 async 函數
   */
  schedule(
    id: string,
    cronExpression: string,
    handler: () => MaybePromise<void>
  ): void;
}
