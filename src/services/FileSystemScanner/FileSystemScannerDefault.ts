import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { type Result, err, ok } from "~shared/utils/Result";

import { type FileSystemScanner, type ScanError } from "./FileSystemScanner";

export class FileSystemScannerDefault implements FileSystemScanner {
  /**
   * 遞迴掃描指定路徑，收集所有檔案的完整路徑。
   */
  async scan(rootPath: string): Promise<Result<string[], ScanError>> {
    try {
      const result: string[] = [];
      await this.walk(rootPath, result);
      return ok(result);
    } catch (e) {
      return err({
        type: "SCAN_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async walk(dir: string, acc: string[]): Promise<void> {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await this.walk(fullPath, acc);
      } else if (dirent.isFile()) {
        acc.push(fullPath);
      }
    }
  }
}
