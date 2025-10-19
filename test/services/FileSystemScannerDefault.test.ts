import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isOk } from "~shared/utils/Result";

import { FileSystemScannerDefault } from "@/services/FileSystemScanner";

const tmpDir = "test/tmp/scanner";

describe("FileSystemScannerDefault", () => {
  test("能遞迴列出所有檔案", async () => {
    // 建立暫存資料夾
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(join(tmpDir, "subdir"), { recursive: true });
    await writeFile(join(tmpDir, "a.txt"), "a");
    await writeFile(join(tmpDir, "subdir", "b.txt"), "b");

    const scanner = new FileSystemScannerDefault();
    const result = await scanner.scan(tmpDir);

    expect(isOk(result)).toBeTrue();
    if (result.ok) {
      const files = result.value;
      expect(files.some((f) => f.endsWith("a.txt"))).toBeTrue();
      expect(files.some((f) => f.endsWith("b.txt"))).toBeTrue();
      expect(files.length).toBe(2);
    }
  });

  test("遇到不存在的路徑應回傳錯誤", async () => {
    const scanner = new FileSystemScannerDefault();
    const result = await scanner.scan("no_such_path");
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.type).toBe("SCAN_FAILED");
    }
  });
});
