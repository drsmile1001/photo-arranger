/**
 * `AsyncLock` 類別是一個簡單的鎖實作，用於控制多個非同步操作的執行順序。
 *
 * ## 功能:
 * - 確保同一時間只有一個操作可以取得鎖。
 * - 支援鎖的排隊機制，後續操作會依序執行。
 *
 * ## 使用場景:
 * 適用於需要避免多個非同步操作同時執行的情況，例如資源競爭或狀態更新。
 */
export class AsyncLock {
  private queue: (() => void)[] = [];
  private locked = false;

  // 多載：無條件執行
  async run<T>(fn: () => Promise<T>): Promise<T>;

  // 多載：條件判斷後執行
  async run<T>(
    shouldRun: () => boolean,
    fn: () => Promise<T>
  ): Promise<T | undefined>;

  // 實作
  async run<T>(
    arg1: (() => Promise<T>) | (() => boolean),
    arg2?: () => Promise<T>
  ): Promise<T | undefined> {
    await this.acquire();
    try {
      if (arg2) {
        // run(shouldRun, fn)
        if (!(arg1 as () => boolean)()) return undefined;
        return await arg2();
      } else {
        // run(fn)
        return await (arg1 as () => Promise<T>)();
      }
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}
