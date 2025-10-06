import type { CAC } from "cac";

import type { Logger } from "~shared/Logger";

export function registerGreeting(cli: CAC, logger: Logger): void {
  cli.command("hello [name]", "向你打招呼").action((name: string = "world") => {
    logger.info()`Hello, ${name}!`;
  });
}
