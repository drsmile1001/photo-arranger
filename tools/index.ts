import { cac } from "cac";

import { createDefaultLoggerFromEnv } from "~shared/Logger";
import { registerProjectList } from "~shared/devkit/ProjectList";
import { registerSubtreeManager } from "~shared/devkit/SubtreeManager";

const logger = createDefaultLoggerFromEnv().extend("cli");
const cli = cac();

registerProjectList(cli, logger);
registerSubtreeManager(cli, logger);

cli.help();
cli.parse(process.argv, { run: false });

if (!cli.matchedCommand) {
  cli.outputHelp();
  process.exit(0);
}

try {
  await cli.runMatchedCommand();
} catch (err) {
  console.error("❌ CLI Error:", err);
  process.exit(1);
}
