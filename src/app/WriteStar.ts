import type { CAC } from "cac";
import path from "node:path";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { ExifServiceExifTool } from "@/services/ExifService/ExifServiceExifTool";
import { StarMapStoreJson } from "@/services/StarMapStoreJson";
import { confirm, exists, expandHome } from "@/utils/helper";

type Options = {
  yes?: boolean;
};

const JPG_EXTS = new Set([".jpg", ".jpeg"]);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(n)));

export function registerWriteStar(cli: CAC, baseLogger: Logger) {
  cli
    .command(
      "write-star <folder>",
      "將 star.json 中 folder 下的星等寫到對應照片中，並刪除無效記錄"
    )
    .option("--yes", "略過確認直接執行", { default: false })
    .action(async (folder: string, options: Options) => {
      const logger = baseLogger.extend("write-star");
      const dumper = new DumpWriterDefault(logger);
      const root = expandHome(folder);

      // 1) 讀 star map
      const store = new StarMapStoreJson();
      const starRes = await store.read();
      if (!starRes.ok) {
        const message =
          starRes.error === "NO_STAR_JSON_PATH"
            ? "未設定環境變數 STAR_JSON_PATH"
            : "讀取 star.json 失敗";
        logger.error({ emoji: "❌", error: starRes.error }, message);
        process.exit(1);
      }
      const starMap = starRes.value;

      // 2) 只處理 <folder> 底下的紀錄
      const entries = Object.entries(starMap).filter(([abs]) => {
        const rel = path.relative(root, abs);
        return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
      });
      if (entries.length === 0) {
        logger.info({ emoji: "ℹ️" })`在指定資料夾底下沒有 star 紀錄`;
        return;
      }

      // 3) 計畫：比對 EXIF Rating → 決定 toWrite / noChanged；不存在 → toDelete
      const toWrite: Record<string, string> = {}; // fileName: "old -> new"
      const noChanged: string[] = []; // fileName[]
      const toDeleteAbs: string[] = []; // abs path（稍後寫回 starMap 用）

      const exif = new ExifServiceExifTool();
      try {
        for (const [absPath, desiredRaw] of entries) {
          // 檔案存在性
          const existsOnDisk = await exists(absPath);
          if (!existsOnDisk) {
            toDeleteAbs.push(absPath);
            continue;
          }

          // 僅處理 JPG/JPEG
          const ext = path.extname(absPath).toLowerCase();
          if (!JPG_EXTS.has(ext)) {
            // 非 JPG 的紀錄不寫入，也不刪除（保留星等記錄）
            continue;
          }

          const fileName = path.basename(absPath);
          const desired = clamp(desiredRaw, 0, 5);

          // 讀 EXIF rating；若讀失敗，以 "-" 當作未知舊值，將進入寫入
          const read = await exif.readExif(absPath);
          if (isErr(read)) {
            toWrite[fileName] = `- -> ${desired}`;
            continue;
          }

          const current =
            typeof read.value.rating === "number"
              ? clamp(read.value.rating, 0, 5)
              : 0; // 無 rating 視同 0

          if (current === desired) {
            noChanged.push(fileName);
          } else {
            toWrite[fileName] = `${current} -> ${desired}`;
          }
        }
      } finally {
        await exif[Symbol.asyncDispose]();
      }

      // 4) 輸出「計劃報告」
      const planReport = {
        summary: {
          toWrite: Object.keys(toWrite).length,
          toDelete: toDeleteAbs.length,
          noChanged: noChanged.length,
        },
        toWrite,
        toDelete: toDeleteAbs.map((p) => path.basename(p)),
        noChanged: noChanged.sort(),
      };
      await dumper.dump("write-star-計劃", planReport);

      if (
        planReport.summary.toWrite === 0 &&
        planReport.summary.toDelete === 0
      ) {
        logger.info({ emoji: "✅" })`沒有需要寫入或清理的條目`;
        return;
      }

      // 5) 確認
      const proceed =
        options.yes ||
        (await confirm(
          logger,
          `將寫入 ${planReport.summary.toWrite} 張 JPG Rating，並清除 ${planReport.summary.toDelete} 筆無效紀錄，是否繼續？ [y/N] `
        ));
      if (!proceed) {
        logger.warn({ emoji: "⏹️" })`使用者取消`;
        return;
      }

      // 6) 執行（寫入＋清理 starMap）
      const writeErrors: Array<{ file: string; error: string }> = [];
      const exif2 = new ExifServiceExifTool();
      try {
        // 寫入
        for (const [fileName, diff] of Object.entries(toWrite)) {
          const abs = path.join(root, "**", fileName); // 我們需要原始絕對路徑來寫
          // 由於 toWrite 用的是檔名做 key，需找到對應的絕對路徑。
          // 為避免 O(N^2) 掃描，改回用 entries 來 map 一次：
        }
      } finally {
        await exif2[Symbol.asyncDispose]();
      }

      // 重新用 abs path 寫入（避免檔名碰撞）
      const toWriteAbs: Array<{ abs: string; file: string; newVal: number }> =
        [];
      for (const [absPath, desiredRaw] of entries) {
        const file = path.basename(absPath);
        if (!(file in toWrite)) continue;
        const match = /->\s*(\d+)$/.exec(toWrite[file]);
        const newVal = match ? parseInt(match[1], 10) : 0;
        toWriteAbs.push({ abs: absPath, file, newVal });
      }

      const exif3 = new ExifServiceExifTool();
      try {
        for (const item of toWriteAbs) {
          const res = await exif3.writeRating(item.abs, item.newVal);
          if (isErr(res))
            writeErrors.push({ file: item.file, error: String(res.error) });
        }
      } finally {
        await exif3[Symbol.asyncDispose]();
      }

      // 清理 starMap（僅刪 <folder> 底下不存在的項目）
      for (const p of toDeleteAbs) {
        delete starMap[p];
      }
      const writeStoreRes = await store.write(starMap);
      if (!writeStoreRes.ok) {
        logger.error({ emoji: "🧨" })`寫回 star.json 失敗`;
        process.exit(1);
      }

      // 7) 結果報告
      const resultReport = {
        summary: {
          toWrite: planReport.summary.toWrite,
          toDelete: planReport.summary.toDelete,
          noChanged: planReport.summary.noChanged,
          writeFailed: writeErrors.length,
        },
        writeFailed: writeErrors,
      };
      await dumper.dump("write-star-結果", resultReport);

      if (writeErrors.length > 0) {
        logger.warn({
          emoji: "⚠️",
          failed: writeErrors.length,
        })`部分檔案寫入失敗`;
      } else {
        logger.info({ emoji: "✅" })`完成 Rating 寫入與無效紀錄清理`;
      }
    });
}
