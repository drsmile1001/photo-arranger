import type { CAC } from "cac";
import { ExifTool } from "exiftool-vendored";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { photoExtensions } from "@/constants";
import { FileSystemScannerDefault } from "@/services/FileSystemScanner/FileSystemScannerDefault";

type Strategy = "sequential" | "pool" | "chunked" | "all";

type BenchOptions = {
  limit?: number | string;
  strategies?: string; // "sequential,pool,chunked,all"
  concurrency?: number | string; // for pool
  batch?: number | string; // for chunked
  runs?: number | string; // measured runs (after warmup)
  noWarmup?: boolean;
  exts?: string; // "jpg,jpeg,nef,arw,cr2,cr3,dng,heic,heif"
};

export function registerReadExifBench(cli: CAC, baseLogger: Logger) {
  cli
    .command(
      "read-exif-bench <folder>",
      "效能測試：不同并行策略下的 EXIF 讀取速度"
    )
    .option("--limit <n>", "限制測試檔案數量", { default: 1000 })
    .option("--strategies <list>", "要測試的策略（逗號分隔）", {
      default: "sequential,pool,chunked,all",
    })
    .option("--concurrency <n>", "pool 併發數", { default: 8 })
    .option("--batch <n>", "chunked 單批大小", { default: 16 })
    .option("--runs <n>", "正式量測次數（暖身之外）", { default: 3 })
    .option("--no-warmup", "跳過暖身", { default: false })
    .option(
      "--exts <list>",
      "副檔名白名單（逗號分隔，預設常見 raw/jpg/heif）",
      { default: "jpg,jpeg,nef,arw,cr2,cr3,dng,heic,heif" }
    )
    .action(async (folder: string, options: BenchOptions) => {
      const logger = baseLogger.extend("bench-exif");
      const root = expandHome(folder);
      const concurrency = toInt(options.concurrency, 8);
      const batchSize = toInt(options.batch, 16);
      const runs = toInt(options.runs, 3);
      const limit = options.limit ? Number(options.limit) : 1000;
      const warmup = options.noWarmup ? false : true;
      const strategies = (options.strategies ?? "sequential,pool,chunked,all")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as Strategy[];
      const exts =
        options.exts?.split(",").map((s) => "." + s.trim().toLowerCase()) ??
        photoExtensions;

      // 1) 掃描檔案
      const scanner = new FileSystemScannerDefault();
      const scanResult = await scanner.scan(root, {
        allowExts: exts,
      });
      if (isErr(scanResult)) {
        logger.error({
          emoji: "❌",
          error: scanResult.error,
        })`掃描來源目錄失敗`;
        process.exit(1);
      }
      const allPaths = scanResult.value;
      if (allPaths.length === 0) {
        logger.warn("來源目錄沒有可處理的相片檔案");
        return;
      }
      const files = limit ? allPaths.slice(0, limit) : allPaths;

      logger.info({
        emoji: "🔎",
      })`掃描完成：共有照片 ${allPaths.length}，參與測試 ${files}`;

      // 2) 顯示測試設定
      logger.info({
        emoji: "⚙️",
        strategies: strategies.join(", "),
        concurrency,
        batchSize,
        runs,
        warmup,
        exts,
      })`測試設定`;

      // 3) 執行各策略
      for (const s of strategies) {
        const label = s.toUpperCase();
        if (warmup) {
          logger.info(`[${label}] 暖身中...`);
          await benchOne(s, files, { concurrency, batch: batchSize });
        }

        const results: BenchResult[] = [];
        for (let i = 0; i < runs; i++) {
          logger.info(`[${label}] 測試 ${i + 1}/${runs}...`);
          results.push(
            await benchOne(s, files, { concurrency, batch: batchSize })
          );
        }

        const msMed = median(results.map((r) => r.ms));
        const fpsMed = median(results.map((r) => r.filesPerSec));
        const errSum = results.reduce((a, r) => a + r.errors, 0);

        logger.info(
          {
            emoji: "📊",
            files: files.length,
            runs,
            medianMs: Math.round(msMed),
            medianFilesPerSec: Number(fpsMed.toFixed(1)),
            totalErrors: errSum,
          },
          `完成 ${label}`
        );
      }
    });
}

// ----------------- 實作細節 -----------------

function expandHome(p: string) {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

function toInt(v: number | string | undefined, dflt: number) {
  if (v === undefined) return dflt;
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? n : dflt;
}

type BenchParams = { concurrency: number; batch: number };
type BenchResult = {
  strategy: Strategy;
  ms: number;
  files: number;
  errors: number;
  filesPerSec: number;
};

async function benchOne(
  strategy: Strategy,
  files: string[],
  params: BenchParams
): Promise<BenchResult> {
  const exiftool = new ExifTool({ taskTimeoutMillis: 120_000 });
  const t0 = performance.now();
  let ok = 0,
    errors = 0;

  try {
    if (strategy === "sequential") {
      const r = await runSequential(exiftool, files);
      ok = r.ok;
      errors = r.err;
    } else if (strategy === "pool") {
      const r = await runPool(exiftool, files, params.concurrency);
      ok = r.ok;
      errors = r.err;
    } else if (strategy === "chunked") {
      const r = await runChunked(exiftool, files, params.batch);
      ok = r.ok;
      errors = r.err;
    } else if (strategy === "all") {
      const r = await runAll(exiftool, files);
      ok = r.ok;
      errors = r.err;
    } else {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
  } finally {
    await exiftool.end();
  }

  const ms = performance.now() - t0;
  const filesPerSec = ok / (ms / 1000);
  return { strategy, ms, files: ok + errors, errors, filesPerSec };
}

async function readOne(exiftool: ExifTool, file: string) {
  try {
    await exiftool.read(file);
    return true;
  } catch {
    return false;
  }
}

async function runSequential(exiftool: ExifTool, files: string[]) {
  let ok = 0,
    err = 0;
  for (const f of files) (await readOne(exiftool, f)) ? ok++ : err++;
  return { ok, err };
}

async function runAll(exiftool: ExifTool, files: string[]) {
  const results = await Promise.all(files.map((f) => readOne(exiftool, f)));
  const ok = results.filter(Boolean).length;
  const err = results.length - ok;
  return { ok, err };
}

async function runPool(
  exiftool: ExifTool,
  files: string[],
  concurrency: number
) {
  let idx = 0,
    ok = 0,
    err = 0,
    active = 0;
  return new Promise<{ ok: number; err: number }>((resolve) => {
    const next = () => {
      while (active < concurrency && idx < files.length) {
        const file = files[idx++];
        active++;
        readOne(exiftool, file)
          .then((r) => (r ? ok++ : err++))
          .finally(() => {
            active--;
            if (ok + err === files.length) resolve({ ok, err });
            else next();
          });
      }
    };
    next();
  });
}

async function runChunked(
  exiftool: ExifTool,
  files: string[],
  batchSize: number
) {
  let ok = 0,
    err = 0;
  for (let i = 0; i < files.length; i += batchSize) {
    const chunk = files.slice(i, i + batchSize);
    const results = await Promise.all(chunk.map((f) => readOne(exiftool, f)));
    const pass = results.filter(Boolean).length;
    ok += pass;
    err += results.length - pass;
  }
  return { ok, err };
}

function median(ns: number[]) {
  const a = [...ns].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
