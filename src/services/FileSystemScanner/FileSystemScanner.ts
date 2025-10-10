import type { Result } from "~shared/utils/Result";

export type ScanError = {
  type: "SCAN_FAILED";
  message: string;
};

export interface FileSystemScanner {
  /**
   * 掃描指定目錄，回傳所有檔案的完整路徑（遞迴包含子資料夾）
   * 不包含目錄，只回傳檔案。
   */
  scan(rootPath: string): Promise<Result<string[], ScanError>>;
}
