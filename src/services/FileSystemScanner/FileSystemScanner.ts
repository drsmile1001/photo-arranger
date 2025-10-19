import type { Result } from "~shared/utils/Result";

export type ScanError = {
  type: "SCAN_FAILED";
  message: string;
};

export interface FileSystemScanner {
  scan(
    rootPath: string,
    options?: { recursive?: boolean; allowExts?: readonly string[] }
  ): Promise<Result<string[], ScanError>>;
}
