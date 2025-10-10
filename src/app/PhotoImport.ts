import { $ } from "bun";

import { CAC } from "cac";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { DumpWriterDefault } from "~shared/DumpWriter/DumpWriterDefault";
import type { Logger } from "~shared/Logger";

export function registerPhotoImport(cli: CAC, logger: Logger) {
  cli
    .command("import <source>", "從相機或外部裝置匯入 DCIM 內容")
    .option("--target <path>", "指定目標目錄，預設為 ~/pictures/photos/import")
    .action(async (source: string, options: { target?: string }) => {
      const start = Date.now();
      const resolvedTarget =
        options.target ?? join(homedir(), "pictures", "photos", "import");

      const importLogger = logger.extend("PhotoImport", { emoji: "📥" });
      const reporter = new DumpWriterDefault(importLogger, "dist/reports");

      importLogger.info({
        event: "prepare",
      })`開始匯入相片：來源=${source} → 目標=${resolvedTarget}`;

      await mkdir(resolvedTarget, { recursive: true });

      const rsyncCmd = [
        "rsync",
        "-avh", // 保留屬性, 顯示進度
        "--info=progress2",
        "--exclude='.Spotlight-V100'",
        "--exclude='.Trashes'",
        "--exclude='*.tmp'",
        `${source}/DCIM/`,
        `${resolvedTarget}/`,
      ];

      importLogger.info({ event: "exec" })`執行命令: ${rsyncCmd.join(" ")}`;

      let result: $.ShellOutput;
      try {
        result = await $`${rsyncCmd}`;
      } catch (error) {
        importLogger.error({ error })`rsync 匯入失敗`;
        process.exit(1);
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      const summary = {
        source,
        target: resolvedTarget,
        command: rsyncCmd.join(" "),
        duration_sec: elapsed,
        stdout_preview: result.stdout.toString().split("\n").slice(-10),
      };

      importLogger.info({ event: "done" })`匯入完成，用時 ${elapsed}s`;
      await reporter.dump("photo-import", summary);
    });
}
