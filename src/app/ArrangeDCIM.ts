import type { CAC } from "cac";
import { format } from "date-fns";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import { DCIMGroupingServiceDefault } from "@/services/DCIMGroupingServiceDefault";
import type { Arrangement } from "@/services/DCIMSeriesDateArrangeService";
import { DCIMSeriesDateArrangeServiceDefault } from "@/services/DCIMSeriesDateArrangeServiceDefault";
import { ExifServiceExifTool } from "@/services/ExifService";
import { FileSystemScannerDefault } from "@/services/FileSystemScanner/FileSystemScannerDefault";
import { confirm, exists, expandHome } from "@/utils/helper";

type ArrangeOptions = {
  target?: string;
  yes?: boolean;
};

const photoExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".tiff",
  ".cr2",
  ".nef",
  ".arw",
  ".orf",
  ".rw2",
]);

export function registerArrangeDCIM(cli: CAC, baseLogger: Logger) {
  cli
    .command("arrange-dcim <folder>", "整理 DCIM 目錄，並以時間系列分資料夾")
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
      const photoPaths = filePaths.filter((p) =>
        photoExtensions.has(path.extname(p).toLowerCase())
      );
      if (photoPaths.length === 0) {
        logger.warn("來源目錄沒有可處理的相片檔案");
        return;
      }
      logger.info({
        emoji: "🔎",
        count: photoPaths.length,
      })`掃描完成，共 ${filePaths.length} 個檔案，其中 ${photoPaths.length} 個為相片`;

      // 2) 分系列（依 DCF 結構）
      const grouping = new DCIMGroupingServiceDefault().group(photoPaths);
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
      await using exifService = new ExifServiceExifTool();
      const arranger = new DCIMSeriesDateArrangeServiceDefault({
        exifService,
        outputRoot: targetRoot,
        logger,
      });
      const allArrangements = [];
      let seriesIndex = 0;
      for (const series of grouping.seriesList) {
        seriesIndex++;
        logger.info({
          emoji: "⏳",
        })`處理${series.directorySuffix}-${series.photoPrefix}系列中... ${seriesIndex}/${grouping.seriesList.length}`;
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

      logger.info({
        emoji: "✅",
        count: allArrangements.length,
      })`搬移計劃產生完成`;

      if (allArrangements.length === 0) {
        logger.warn({
          emoji: "🟡",
        })`沒有可搬移項目`;
        return;
      }

      // 4) 產生搬移計劃報告
      await reportPlan(reporter, allArrangements);

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
      logger.info("開始搬移...");
      let moved = 0;
      for (const item of allArrangements) {
        await mkdir(path.dirname(item.targetPath), { recursive: true });
        // 安全防呆：不覆蓋既有檔案
        if (await exists(item.targetPath)) {
          logger.error({
            event: "target-exists",
            emoji: "🧨",
            origin: item.originPath,
            target: item.targetPath,
          })`目標 ${item.targetPath} 已存在，停止（避免覆蓋）`;
          process.exit(1);
        }
        await rename(item.originPath, item.targetPath);
        moved++;
        logger.info({
          event: "moved",
          emoji: "📦",
          count: moved,
          from: item.originPath,
          to: item.targetPath,
        })`${item.originPath} → ${item.targetPath} 搬移完成 (${moved}/${allArrangements.length})`;
      }
      logger.info({
        event: "done",
        emoji: "✅",
        moved,
      })`全部搬移完成，共搬移 ${moved} 個檔案`;
    });
}

async function reportPlan(
  dumper: DumpWriterDefault,
  arrangements: Arrangement[]
) {
  const byDir = arrangements.reduce((acc, cur) => {
    const dir = path.basename(path.dirname(cur.targetPath));
    const list = acc.get(dir) ?? [];
    list.push(cur);
    acc.set(dir, list);
    return acc;
  }, new Map<string, Arrangement[]>());
  const total = arrangements.length;

  const summary = {
    total,
    dirCount: byDir.size,
    dirs: byDir.entries().reduce(
      (obj, [dir, arr]) => {
        obj[dir] = {
          count: arr.length,
          maxOverflow: Math.max(...arr.map((a) => a.overflow)),
          first: arr[0].targetPath,
          last: arr[arr.length - 1].targetPath,
        };
        return obj;
      },
      {} as Record<
        string,
        { count: number; maxOverflow: number; first: string; last: string }
      >
    ),
  };

  await dumper.dump("搬移計劃摘要", summary);

  for (const [dir, arrangements] of byDir.entries()) {
    const arrangeSummary = arrangements.map((a) => ({
      from: a.originPath,
      to: a.targetPath,
      time: format(a.captureTime, "HH:mm:ss"),
    }));
    await dumper.dump(`搬移目標目錄-${dir}`, {
      maxOverflow: Math.max(...arrangements.map((a) => a.overflow)),
      total: arrangements.length,
      photos: arrangeSummary,
    });
  }
}
