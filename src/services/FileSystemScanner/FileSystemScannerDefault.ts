import { readdir } from "node:fs/promises";
import path from "node:path";

import { type Result, err, ok } from "~shared/utils/Result";

import { type FileSystemScanner, type ScanError } from "./FileSystemScanner";

export class FileSystemScannerDefault implements FileSystemScanner {
  async scan(
    rootPath: string,
    options?: { recursive?: boolean; allowExts?: readonly string[] }
  ): Promise<Result<string[], ScanError>> {
    const allowExts = options?.allowExts ?? [];
    const isRecursive = options?.recursive ?? true;
    const lowerExts = allowExts.map((e) => {
      if (e.startsWith(".")) return e.toLowerCase();
      return `.${e.toLowerCase()}`;
    });
    const allowExtsSet = new Set(lowerExts);
    try {
      const files = await readdir(rootPath, {
        recursive: isRecursive,
        withFileTypes: true,
      });
      const fullPaths = files
        .filter((d) => {
          if (!d.isFile()) return false;
          if (allowExts.length === 0) return true;
          const ext = path.extname(d.name).toLowerCase();
          return allowExtsSet.has(ext);
        })
        .map((d) => `${d.parentPath}/${d.name}`);
      return ok(fullPaths);
    } catch (e) {
      return err({
        type: "SCAN_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
