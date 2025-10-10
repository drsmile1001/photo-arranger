import { describe, expect, test } from "bun:test";
import { addSeconds, format } from "date-fns";
import path from "node:path";

import { buildTestLogger } from "~shared/testkit/TestLogger";

import type { DCIMPhoto, DCIMSeries } from "@/services/DCIMGroupingService";
import { DCIMSeriesDateArrangeServiceDefault } from "@/services/DCIMSeriesDateArrangeServiceDefault";

import { ExifServiceFake } from "~test/fakes/ExifServiceFake";

// ---- 測試共同工具 ----
function buildContext() {
  const logger = buildTestLogger();
  const exifService = new ExifServiceFake();

  const service = new DCIMSeriesDateArrangeServiceDefault({
    exifService,
    outputRoot: "/home/photos/pick",
    logger,
  });

  function seedSeries(config: {
    directorySuffix: string;
    photoPrefix: string;
    sourceRoot: string;
    photos: {
      dirSerial: number;
      fileSerial: number;
      ext: string;
      exifDate?: Date | "error" | null; // null => NO_EXIF_DATA
    }[];
  }): DCIMSeries {
    const photos: DCIMPhoto[] = config.photos.map((p) => {
      const fileName = `${config.photoPrefix}${String(p.fileSerial).padStart(
        4,
        "0"
      )}.${p.ext}`;
      const fullPath = path.join(
        config.sourceRoot,
        `DCIM`,
        `${String(p.dirSerial).padStart(3, "0")}${config.directorySuffix}`,
        fileName
      );

      if (p.exifDate === "error") {
        exifService.setReadError(fullPath, {
          type: "READ_FAILED",
          message: "Simulated read error",
        });
      } else if (p.exifDate === null) {
        exifService.setReadError(fullPath, {
          type: "NO_EXIF_DATA",
          message: "No exif in file",
        });
      } else if (p.exifDate instanceof Date) {
        exifService.setExif(fullPath, {
          filePath: fullPath,
          captureDate: p.exifDate,
        });
      }
      // 若未指定 exifDate，維持 FILE_NOT_FOUND 預設（不常用於本測試）

      return {
        fullPath,
        fileName,
        extension: p.ext,
        directorySuffix: config.directorySuffix,
        directorySerial: p.dirSerial,
        prefix: config.photoPrefix,
        fileSerial: p.fileSerial,
      };
    });

    return {
      directorySuffix: config.directorySuffix,
      photoPrefix: config.photoPrefix,
      matchDCFDirectory: true,
      photos,
    };
  }

  return { exifService, service, seedSeries };
}

// ---- 測試開始 ----
describe("DCIMSeriesDateArrangeServiceDefault", () => {
  test("單一日期、無 overflow 正確產生排列與目標路徑", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T12:00:00Z");

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 1, ext: "JPG", exifDate: date },
        { dirSerial: 100, fileSerial: 2, ext: "JPG", exifDate: date },
      ],
    });

    const result = await service.arrange(series);
    expect(result.issues.length).toBe(0);
    expect(result.arrangement.length).toBe(2);

    const arr = result.arrangement[0];
    expect(arr.captureDate).toBe(format(date, "yyyyMMdd"));
    expect(arr.targetPath).toBe(
      "/home/photos/pick/20240817-NIKON-DSC_/DSC_0001.JPG"
    );
  });

  test("跨 9999 overflow 應標記 overflow=1 並修正檔名", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T12:00:00Z");

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 9999, ext: "JPG", exifDate: date },
        {
          dirSerial: 101,
          fileSerial: 1,
          ext: "JPG",
          exifDate: addSeconds(date, 10),
        },
      ],
    });

    const result = await service.arrange(series);
    expect(result.issues.length).toBe(0);

    const overflowed = result.arrangement.find((a) =>
      a.originPath.includes("0001.JPG")
    );
    expect(overflowed?.overflow).toBe(1);
    // 你的實作目前為 prefix + overflowStr(補零) + serial
    // 例：DSC_10001.JPG（當 maxOverflowDigits=1 時 overflow=1 → "1"）
    expect(overflowed?.targetPath).toBe(
      "/home/photos/pick/20240817-NIKON-DSC_/DSC_10001.JPG"
    );
  });

  test("EXIF 讀取失敗、無 EXIF、無效時間 應進入 issues", async () => {
    const { seedSeries, service } = buildContext();

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 1, ext: "JPG", exifDate: "error" }, // READ_FAILED
        { dirSerial: 100, fileSerial: 2, ext: "JPG", exifDate: null }, // NO_EXIF_DATA
        // INVALID_TIME 透過 setExif 傳入一個 Invalid Date
        {
          dirSerial: 100,
          fileSerial: 3,
          ext: "JPG",
          exifDate: new Date("invalid"),
        },
      ],
    });

    const result = await service.arrange(series);
    // 其中 INVALID_TIME 是 arrange 時檢出的，另外兩個是 fake 回傳的錯誤
    expect(result.issues.length).toBe(3);

    const types = result.issues.map((i) => i.type).sort();
    expect(types).toEqual(["INVALID_TIME", "NO_EXIF_DATA", "READ_FAILED"]);
  });

  test("不同日期應分別建立輸出資料夾", async () => {
    const { seedSeries, service } = buildContext();

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        {
          dirSerial: 100,
          fileSerial: 1,
          ext: "JPG",
          exifDate: new Date("2024-08-17T12:00:00Z"),
        },
        {
          dirSerial: 100,
          fileSerial: 2,
          ext: "JPG",
          exifDate: new Date("2024-08-18T09:00:00Z"),
        },
      ],
    });

    const result = await service.arrange(series);
    const dirs = new Set(
      result.arrangement.map((a) => path.dirname(a.targetPath))
    );

    expect(Array.from(dirs)).toEqual([
      "/home/photos/pick/20240817-NIKON-DSC_",
      "/home/photos/pick/20240818-NIKON-DSC_",
    ]);
  });

  test("同資料夾內 JPG 與 NEF 共存，應保持原序列號與不同副檔名", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T10:00:00Z");

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 1234, ext: "JPG", exifDate: date },
        { dirSerial: 100, fileSerial: 1234, ext: "NEF", exifDate: date },
      ],
    });

    const result = await service.arrange(series);
    expect(result.issues.length).toBe(0);
    expect(result.arrangement.length).toBe(2);

    const jpg = result.arrangement.find((a) => a.originPath.endsWith(".JPG"));
    const nef = result.arrangement.find((a) => a.originPath.endsWith(".NEF"));
    expect(jpg?.photoSerial).toBe(1234);
    expect(nef?.photoSerial).toBe(1234);
    expect(jpg?.targetPath.endsWith(".JPG")).toBeTrue();
    expect(nef?.targetPath.endsWith(".NEF")).toBeTrue();
  });

  test("同資料夾內不同序列號應保持序列遞增，不應產生 overflow", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T10:00:00Z");

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 1001, ext: "JPG", exifDate: date },
        {
          dirSerial: 100,
          fileSerial: 1002,
          ext: "JPG",
          exifDate: addSeconds(date, 1),
        },
        {
          dirSerial: 100,
          fileSerial: 1003,
          ext: "JPG",
          exifDate: addSeconds(date, 2),
        },
      ],
    });

    const result = await service.arrange(series);
    const overflows = result.arrangement.map((a) => a.overflow);
    expect(overflows).toEqual([0, 0, 0]);
  });

  test("不同資料夾、相同日期且序列重啟 → 應產生 overflow", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T10:00:00Z");

    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 9999, ext: "JPG", exifDate: date },
        {
          dirSerial: 101,
          fileSerial: 1,
          ext: "JPG",
          exifDate: date,
        },
      ],
    });

    const result = await service.arrange(series);
    console.log(result);

    const [first, second] = result.arrangement;
    expect(first.overflow).toBe(0);
    expect(second.overflow).toBe(1);
    expect(second.targetPath).toMatch(/DSC_10001\.JPG$/);
  });

  test("目標路徑重複應輸出 DUPLICATE_TARGET issue", async () => {
    const { seedSeries, service } = buildContext();
    const date = new Date("2024-08-17T10:00:00Z");

    // 模擬同一日期、同一資料夾、同序號、同副檔名（不同來源檔案） → 應碰撞
    const series = seedSeries({
      directorySuffix: "NIKON",
      photoPrefix: "DSC_",
      sourceRoot: "/",
      photos: [
        { dirSerial: 100, fileSerial: 1234, ext: "JPG", exifDate: date },
        {
          dirSerial: 100,
          fileSerial: 1234,
          ext: "JPG",
          exifDate: addSeconds(date, 1),
        },
      ],
    });

    const result = await service.arrange(series);
    expect(result.issues.some((i) => i.type === "DUPLICATE_TARGET")).toBeTrue();
  });
});
