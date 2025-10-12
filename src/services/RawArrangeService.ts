import type { ArrangePlan } from "@/types";

export interface RawArrangeService {
  /**
   * 根據「檔案清單」產生 RAW 整理計畫。
   */
  planFromList(filePaths: string[]): ArrangePlan;
}
