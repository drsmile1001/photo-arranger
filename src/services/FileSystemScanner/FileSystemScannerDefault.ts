import { readdir } from "node:fs/promises";

import { type Result, err, ok } from "~shared/utils/Result";

import { type FileSystemScanner, type ScanError } from "./FileSystemScanner";

export class FileSystemScannerDefault implements FileSystemScanner {
  /**
   * 遞迴掃描指定路徑，收集所有檔案的完整路徑。
   */
  async scan(rootPath: string): Promise<Result<string[], ScanError>> {
    try {
      const files = await readdir(rootPath, {
        recursive: true,
        withFileTypes: true,
      });
      const fullPaths = files
        .filter((d) => d.isFile())
        .map((d) => `${rootPath}/${d.name}`);
      return ok(fullPaths);
    } catch (e) {
      return err({
        type: "SCAN_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
