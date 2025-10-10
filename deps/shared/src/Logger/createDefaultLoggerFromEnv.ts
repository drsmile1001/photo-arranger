import { Value } from "@sinclair/typebox/value";

import { type LogLevel, logLevelEnum } from "./Logger";
import { LoggerConsole } from "./LoggerConsole";

export function createDefaultLoggerFromEnv() {
  let LOG_LEVEL = process.env.LOG_LEVEL;
  let LOG_WITH_CONTEXT = process.env.LOG_WITH_CONTEXT;

  if (!LOG_LEVEL) {
    LOG_LEVEL = "info";
  } else if (!Value.Check(logLevelEnum, LOG_LEVEL)) {
    console.warn(`Invalid LOG_LEVEL: ${LOG_LEVEL}. Defaulting to "info".`);
    LOG_LEVEL = "info";
  }

  if (LOG_WITH_CONTEXT) {
    if (LOG_WITH_CONTEXT !== "inline" && LOG_WITH_CONTEXT !== "object") {
      console.warn(
        `Invalid LOG_WITH_CONTEXT: ${LOG_WITH_CONTEXT}. Defaulting to "inline".`
      );
      LOG_WITH_CONTEXT = "inline";
    }
  }

  const notProduction = process.env.NODE_ENV !== "production";
  return new LoggerConsole(
    LOG_LEVEL as LogLevel,
    [],
    {},
    emojiMapDefault,
    notProduction,
    notProduction,
    (LOG_WITH_CONTEXT as "inline" | "object" | undefined) ?? false
  );
}

export const emojiMapDefault: Record<string, string> = {
  start: "🏁",
  done: "✅",
  error: "❌",
  retry: "🔁",
  warn: "⚠️ ",
  info: "ℹ️ ",
  trace: "🔍",
  debug: "🐛",
};
