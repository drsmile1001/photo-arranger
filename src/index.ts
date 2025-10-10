import { cac } from "cac";

import { createDefaultLoggerFromEnv } from "~shared/Logger";

import { registerArrange } from "./app/Arrange";
import { registerPhotoImport } from "./app/PhotoImport";
import { registerReadExifBench } from "./app/ReadExifBench";

const logger = createDefaultLoggerFromEnv();
const cli = cac();

registerPhotoImport(cli, logger);
registerArrange(cli, logger);
registerReadExifBench(cli, logger);

cli.help();
cli.parse(process.argv, { run: false });

if (!cli.matchedCommand) {
  cli.outputHelp();
  process.exit(0);
}

try {
  await cli.runMatchedCommand();
} catch (error) {
  logger.error({ error }, "執行命令時發生錯誤");
  process.exit(1);
}
