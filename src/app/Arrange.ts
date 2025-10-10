import type { CAC } from "cac";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { DCIMGroupingServiceDefault } from "@/services/DCIMGroupingServiceDefault";
import { DCIMSeriesDateArrangeServiceDefault } from "@/services/DCIMSeriesDateArrangeServiceDefault";
import { ExifServiceExifTool } from "@/services/ExifService";
import { FileSystemScannerDefault } from "@/services/FileSystemScanner/FileSystemScannerDefault";

type ArrangeOptions = {
  target?: string;
  yes?: boolean;
};

export function registerArrange(cli: CAC, baseLogger: Logger) {
  cli
    .command("arrange <folder>", "整理 DCIM 目錄，並以時間系列分資料夾")
    .option("--target <path>", "指定目標目錄，預設 ~/pictures/photos/pick")
    .option("--yes", "略過確認，直接執行搬移", { default: false })
    .action(async (folder: string, options: ArrangeOptions) => {
      const logger = baseLogger.extend("arrange", { folder, options });
      const reporter = new DumpWriterDefault(logger);

      const targetRoot = expandHome(options.target ?? "~/pictures/photos/pick");
      logger.info({
        emoji: "📁",
      })`來源: ${folder} → 目標: ${targetRoot}`;

      // 1) 掃描檔案
      const scanner = new FileSystemScannerDefault();
      const scanRes = await scanner.scan(folder);
      if (isErr(scanRes)) {
        logger.error({
          emoji: "❌",
          error: scanRes.error,
        })`掃描來源目錄失敗`;
        process.exit(1);
      }
      const filePaths = scanRes.value;
      if (filePaths.length === 0) {
        logger.warn("來源目錄沒有可處理檔案");
        return;
      }
      logger.info({
        emoji: "🔎",
        count: filePaths.length,
      })`掃描完成，共 ${filePaths.length} 個檔案`;

      // 2) 分系列（依 DCF 結構）
      const grouping = new DCIMGroupingServiceDefault().group(filePaths);
      if (grouping.issues.length > 0) {
        await reporter.dump("grouping-issues", grouping);
        logger.error({
          count: grouping.issues.length,
        })`發現不合法檔名/序號，已輸出報告。中止。`;
        process.exit(1);
      }
      if (grouping.seriesList.length === 0) {
        logger.warn({
          emoji: "🟡",
        })`沒有可識別的 DCIM 系列`;
        return;
      }
      logger.info({
        emoji: "📚",
        seriesCount: grouping.seriesList.length,
      })`分系列完成`;

      // 3) 逐系列產生搬移計劃（含 EXIF 讀取、overflow 判定）
      const exifService = new ExifServiceExifTool();
      const arranger = new DCIMSeriesDateArrangeServiceDefault({
        exifService,
        outputRoot: targetRoot,
      });
      const allArrangements = [];
      for (const series of grouping.seriesList) {
        const result = await arranger.arrange(series);
        if (result.issues.length > 0) {
          await reporter.dump("arrange-issues", {
            series: {
              directorySuffix: series.directorySuffix,
              photoPrefix: series.photoPrefix,
            },
            issues: result.issues,
          });
          logger.error({
            emoji: "❌",
            series: series.directorySuffix + "-" + series.photoPrefix,
            count: result.issues.length,
          })`EXIF/安排出錯，已輸出報告。中止。`;
          process.exit(1);
        }
        allArrangements.push(...result.arrangement);
      }

      if (allArrangements.length === 0) {
        logger.warn({
          emoji: "🟡",
        })`沒有可搬移項目`;
        return;
      }

      // 4) 產生搬移計劃報告
      const plan = summarizePlan(allArrangements);
      await reporter.dump("arrange-plan", plan);
      logger.info({
        emoji: "📝",
        files: allArrangements.length,
        dirs: Object.keys(plan.byDir).length,
      })`搬移計劃已輸出`;

      // 5) 確認 / 執行
      const proceed =
        options.yes ||
        (await confirm(
          logger,
          `即將搬移 ${allArrangements.length} 個檔案，是否繼續？ [y/N] `
        ));
      if (!proceed) {
        logger.warn({
          emoji: "⏹️",
        })`使用者取消`;
        return;
      }

      // 6) 實際搬移
      let moved = 0;
      for (const item of allArrangements) {
        await mkdir(path.dirname(item.targetPath), { recursive: true });
        // 安全防呆：不覆蓋既有檔案
        if (await exists(item.targetPath)) {
          logger.error({
            emoji: "🧨",
            origin: item.originPath,
            target: item.targetPath,
          })`目標已存在，停止（避免覆蓋）`;
          process.exit(1);
        }
        await rename(item.originPath, item.targetPath);
        moved++;
      }
      logger.info({
        emoji: "✅",
        moved,
      })`搬移完成`;
    });
}

// helpers
function expandHome(p: string) {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

async function confirm(logger: Logger, question: string) {
  const rl = createInterface({ input, output });
  const ans = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function summarizePlan(
  arrangement: Array<{
    originPath: string;
    targetPath: string;
    captureDate: string;
    overflow: number;
  }>
) {
  const byDir: Record<string, number> = {};
  for (const a of arrangement) {
    const dir = path.dirname(a.targetPath);
    byDir[dir] = (byDir[dir] ?? 0) + 1;
  }
  return {
    total: arrangement.length,
    byDir,
    sample: arrangement.slice(0, 10).map((a) => ({
      from: a.originPath,
      to: a.targetPath,
      date: a.captureDate,
      overflow: a.overflow,
    })),
  };
}
