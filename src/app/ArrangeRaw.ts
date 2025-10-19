import type { CAC } from "cac";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { photoExtensions } from "@/constants";
import { FileSystemScannerDefault } from "@/services/FileSystemScanner/FileSystemScannerDefault";
import { RawArrangeServiceDefault } from "@/services/RawArrangeServiceDefault";
import type { ArrangePlan, MoveFile } from "@/types";
import { confirm, exists, expandHome } from "@/utils/helper";

type ArrangeRawOptions = {
  yes?: boolean;
};

export function registerArrangeRaw(cli: CAC, baseLogger: Logger) {
  cli
    .command(
      "arrange-raw <folder>",
      "整理 RAW：同層有 JPG 則移至 raw/，否則刪除；raw/ 下若上層無 JPG 則刪除"
    )
    .option("--yes", "略過確認直接執行", { default: false })
    .action(async (folder: string, options: ArrangeRawOptions) => {
      const logger = baseLogger.extend("arrange-raw");
      const root = expandHome(folder);

      // 掃描
      const scanner = new FileSystemScannerDefault();
      const scanRes = await scanner.scan(root, {
        allowExts: photoExtensions,
      });
      if (isErr(scanRes)) {
        logger.error({ emoji: "❌", error: scanRes.error })`掃描來源目錄失敗`;
        process.exit(1);
      }
      const photos = scanRes.value;
      if (photos.length === 0) {
        logger.warn("來源目錄沒有可處理的相片檔案");
        return;
      }
      logger.info({ emoji: "🔎", count: photos.length })`掃描完成`;

      // 規劃
      const service = new RawArrangeServiceDefault();
      const plan = service.planFromList(photos);

      if (plan.moves.length === 0 && plan.deletes.length === 0) {
        logger.info({ emoji: "✅" })`沒有需要處理的 RAW 檔案`;
        return;
      }
      const writer = new DumpWriterDefault(logger);
      await reportPlan(writer, folder, plan);

      // 確認
      const proceed =
        options.yes ||
        (await confirm(
          logger,
          `將搬移 ${plan.moves.length} 個 RAW、刪除 ${plan.deletes.length} 個 RAW，是否繼續？ [y/N] `
        ));
      if (!proceed) {
        logger.warn({ emoji: "⏹️" })`使用者取消`;
        return;
      }

      // 執行（先搬移，再刪除）
      let moved = 0,
        deleted = 0;

      for (const m of plan.moves) {
        await mkdir(path.dirname(m.to), { recursive: true });
        // 防覆蓋
        if (await exists(m.to)) {
          logger.error({
            emoji: "🧨",
            from: m.from,
            to: m.to,
          })`目標已存在，停止（避免覆蓋）`;
          process.exit(1);
        }
        await rename(m.from, m.to);
        moved++;
      }

      for (const d of plan.deletes) {
        await unlink(d);
        deleted++;
      }

      logger.info({ emoji: "✅", moved, deleted })`RAW 整理完成`;
    });
}

export async function reportPlan(
  dumper: DumpWriterDefault,
  folder: string,
  plan: ArrangePlan
) {
  const grouped = groupPlanByRelativeFolder(folder, plan);
  await dumper.dump("raw檔整理計劃", grouped);
}

function groupPlanByRelativeFolder(root: string, plan: ArrangePlan) {
  const deletes: Record<string, string[]> = {};
  const moves: Record<string, MoveFile[]> = {};

  const relKey = (absDir: string) => {
    const k = path.relative(root, absDir);
    return k === "" ? "." : k;
  };

  // --- deletes ---
  for (const abs of plan.deletes) {
    const dir = path.dirname(abs);
    const key = relKey(dir);
    const relFile = path.relative(root, abs);
    (deletes[key] ??= []).push(relFile);
  }

  // --- moves (以來源所在資料夾分組) ---
  for (const m of plan.moves) {
    const key = relKey(path.dirname(m.from));
    const fromRel = path.relative(root, m.from);
    const toRel = path.relative(root, m.to);
    (moves[key] ??= []).push({ from: fromRel, to: toRel });
  }

  // 穩定排序（群組名排序、群組內容排序）
  const sortObj = <T>(
    obj: Record<string, T[]>,
    sorter: (a: T, b: T) => number
  ) =>
    Object.fromEntries(
      Object.entries(obj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, arr]) => [k, [...arr].sort(sorter)])
    );

  const deletesSorted = sortObj(deletes, (a, b) => a.localeCompare(b));
  const movesSorted = sortObj(moves, (a, b) => {
    // 先比 to，再比 from，讓同目標聚在一起
    const byTo = a.to.localeCompare(b.to);
    return byTo !== 0 ? byTo : a.from.localeCompare(b.from);
  });

  return { deletes: deletesSorted, moves: movesSorted };
}
