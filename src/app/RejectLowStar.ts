import type { CAC } from "cac";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { jpgExtensions } from "@/constants";
import { FileSystemScannerDefault } from "@/services/FileSystemScanner/FileSystemScannerDefault";

type RejectOptions = {
  minLevel?: number | string;
  trashFolder?: string;
  yes?: boolean;
  nonRecursive?: boolean; // 若要只看單層
};

type StarMap = Record<string, number>;

export function registerRejectLowStar(cli: CAC, baseLogger: Logger) {
  cli
    .command(
      "reject-low-star <folder>",
      "剔除低星級的 JPG（將檔案搬到 trash 資料夾）"
    )
    .option("--min-level <n>", "最低接受星級別，預設 2", { default: 2 })
    .option(
      "--trash-folder <path>",
      "剔除目標資料夾，預設 ~/pictures/photos/trash",
      {
        default: "~/pictures/photos/trash",
      }
    )
    .option("--yes", "略過確認，直接執行", { default: false })
    .option("--non-recursive", "只掃描單層，不遞迴", { default: false })
    .action(async (folder: string, options: RejectOptions) => {
      const logger = baseLogger.extend("reject-low-star");

      // 1) 掃描 JPG
      const root = expandHome(folder);
      const scanner = new FileSystemScannerDefault();
      const scanRes = await scanner.scan(root, {
        recursive: !options.nonRecursive,
        allowExts: jpgExtensions.values().toArray(),
      });
      if (isErr(scanRes)) {
        logger.error({ emoji: "❌", error: scanRes.error })`掃描來源目錄失敗`;
        process.exit(1);
      }
      const jpgs = scanRes.value;
      if (jpgs.length === 0) {
        logger.warn("找不到 JPG/JPEG");
        return;
      }
      logger.info({ emoji: "🔎", count: jpgs.length })`掃描完成（JPG/JPEG）`;

      // 2) 讀取星等 JSON（從環境變數）
      const starJsonPath = Bun.env.STAR_JSON_PATH;
      if (!starJsonPath) {
        logger.error({ emoji: "❌" })`未設定 STAR_JSON_PATH 環境變數`;
        process.exit(1);
      }
      const starMap = await readStarJson(starJsonPath);
      logger.info({
        emoji: "⭐",
        entries: Object.keys(starMap).length,
      })`載入星等表`;

      // 3) 取得星等
      const minLevel = toInt(options.minLevel, 2);
      const jpgWithStar = jpgs.map((full) => {
        const rating = starMap[full] ?? 0; // 沒有就 0
        return { full, file: path.basename(full), rating };
      });

      // 4) 產生報告
      const report = makeReport(jpgWithStar);
      const dumper = new DumpWriterDefault(logger);
      await dumper.dump("reject-low-star-report", report);

      const jpgWithStarFiltered = jpgWithStar.filter(
        (r) => r.rating < minLevel
      );

      if (jpgWithStarFiltered.length === 0) {
        logger.info({ emoji: "✅" })`沒有需要剔除的 JPG`;
        return;
      }

      // 5) 確認
      const trashRoot = expandHome(
        options.trashFolder ?? "~/pictures/photos/trash"
      );
      const batchDirName = `${path.basename(root)}_${timestamp()}`;
      const trashBatch = path.join(trashRoot, batchDirName);

      const proceed =
        options.yes ||
        (await confirm(
          logger,
          `將搬移 ${jpgWithStarFiltered.length} 個 JPG 至：${trashBatch}，是否繼續？ [y/N] `
        ));
      if (!proceed) {
        logger.warn({ emoji: "⏹️" })`使用者取消`;
        return;
      }

      // 6) 搬移
      await mkdir(trashBatch, { recursive: true });

      let moved = 0;
      for (const r of jpgWithStarFiltered) {
        const dest = path.join(trashBatch, r.file);
        // 防覆蓋
        if (await exists(dest)) {
          logger.warn({ emoji: "⚠️", dest })`目標已存在，略過`;
          continue;
        }
        await rename(r.full, dest);
        moved++;
      }

      logger.info({ emoji: "✅", moved, target: trashBatch })`搬移完成`;
    });
}

// helpers

async function readStarJson(p: string): Promise<StarMap> {
  const text = await Bun.file(p).text();
  const obj = JSON.parse(text) as Record<string, number>;
  // 轉 key 為原樣（保持絕對路徑），數值需為整數
  const out: StarMap = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") out[k] = Math.trunc(v);
  }
  return out;
}

function makeReport(
  rejects: Array<{ full: string; file: string; rating: number }>
) {
  // 統計
  const byStar: Record<`star_${0 | 1 | 2 | 3 | 4 | 5}`, number> = {
    star_0: 0,
    star_1: 0,
    star_2: 0,
    star_3: 0,
    star_4: 0,
    star_5: 0,
  };
  for (const r of rejects) {
    const key =
      `star_${Math.max(0, Math.min(5, r.rating))}` as keyof typeof byStar;
    byStar[key] += 1;
  }
  // 列出檔名 -> 星等
  const listing: Record<string, number> = {};
  for (const r of rejects) {
    listing[r.file] = r.rating;
  }

  return {
    total: rejects.length,
    byStarTotal: byStar,
    rejects: listing,
  };
}

function timestamp() {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toInt(v: number | string | undefined, dflt: number) {
  if (v === undefined) return dflt;
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? n : dflt;
}

function expandHome(p: string) {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function confirm(logger: Logger, question: string) {
  const rl = createInterface({ input, output });
  const a = (await rl.question(question)).trim().toLowerCase();
  await rl.close();
  return a === "y" || a === "yes";
}
