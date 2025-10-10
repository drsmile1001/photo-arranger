import { cac } from "cac";

import { createDefaultLoggerFromEnv } from "~shared/Logger";
import { registerProjectList } from "~shared/devkit/ProjectList";
import { registerPublish } from "~shared/devkit/Publish";

const logger = createDefaultLoggerFromEnv();
const cli = cac();

registerProjectList(cli, logger);
registerPublish(cli, logger);

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
