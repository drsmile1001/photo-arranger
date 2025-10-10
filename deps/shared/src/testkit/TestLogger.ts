import { LoggerConsole, emojiMapDefault } from "~shared/Logger";

import { getTestConfig } from "./TestConfig";

export function buildTestLogger() {
  const { TEST_LOGGER_LEVEL, TEST_LOG_WITH_CONTEXT } = getTestConfig();
  const logger = new LoggerConsole(
    TEST_LOGGER_LEVEL,
    [],
    {},
    emojiMapDefault,
    true,
    true,
    TEST_LOG_WITH_CONTEXT
  );
  return logger;
}
