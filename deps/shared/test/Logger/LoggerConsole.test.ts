import { Type as t } from "@sinclair/typebox";
import { describe, expect, test } from "bun:test";
import kleur from "kleur";

import { buildConfigFactoryEnv, envBoolean } from "~shared/ConfigFactory";
import { type LogTransport, LoggerConsole } from "~shared/Logger";
import { DiscordWebhookTransport } from "~shared/Logger/DiscordWebhookTransport";
import { RfsTransport } from "~shared/Logger/RfsTransport";
import { dispose } from "~shared/utils/Disposeable";

const getLoggerConsoleTestConfig = buildConfigFactoryEnv(
  t.Object({
    TEST_LOGGER_CONSOLE_TEST_OUTPUT: t.Optional(envBoolean()),
    TEST_LOGGER_DISCORD_WEBHOOK_URL: t.Optional(t.String()),
    TEST_SKIP_DISCORD_WEBHOOK_TEST: t.Optional(envBoolean()),
  })
);

const { TEST_SKIP_DISCORD_WEBHOOK_TEST, TEST_LOGGER_DISCORD_WEBHOOK_URL } =
  getLoggerConsoleTestConfig();

function captureConsole<T>(fn: () => T): {
  output: string;
  errorOutput: string;
  result: T;
} {
  const output =
    getLoggerConsoleTestConfig().TEST_LOGGER_CONSOLE_TEST_OUTPUT ?? false;
  let logOut = "";
  let errorOut = "";
  const original = {
    trace: console.trace,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
    log: console.log,
  };

  console.trace = (...args) => (logOut += args.join(" ") + "\n");
  console.debug = (...args) => (logOut += args.join(" ") + "\n");
  console.info = (...args) => (logOut += args.join(" ") + "\n");
  console.warn = (...args) => (logOut += args.join(" ") + "\n");
  console.log = (...args) => (logOut += args.join(" ") + "\n");
  console.error = (...args) => (errorOut += args.join(" ") + "\n");

  let result: T;
  try {
    result = fn();
  } finally {
    Object.assign(console, original);
  }
  if (output) {
    fn();
  }

  return { output: logOut.trim(), errorOutput: errorOut.trim(), result };
}

function expectConsoleContains(
  fn: () => void,
  contains: {
    out?: string[];
    errorOut?: string[];
  }
) {
  const { output, errorOutput } = captureConsole(fn);
  if (contains.out)
    for (const str of contains.out) {
      expect(output).toContain(str);
    }
  if (contains.errorOut)
    for (const str of contains.errorOut) {
      expect(errorOutput).toContain(str);
    }
}

const emojiMap = {
  start: "🏁",
  done: "✅",
  info: "ℹ️",
  error: "❌",
  warn: "⚠️",
  debug: "🐛",
};

describe("LoggerConsole", () => {
  test("log with context emoji overrides map", () => {
    const logger = new LoggerConsole("debug", [], {}, emojiMap);
    const { output } = captureConsole(() =>
      logger.info({ event: "start", emoji: "🌟", userId: "abc" }, "啟動")
    );
    expect(output).toContain("🌟");
    expect(output).toContain("start: 啟動");
    expect(output).toContain('"userId":"abc"');
  });

  test("log falls back to emojiMap[event]", () => {
    const logger = new LoggerConsole("info", [], {}, emojiMap);
    const { output } = captureConsole(() =>
      logger.info({ event: "start" }, "同步開始")
    );
    expect(output).toContain("🏁");
    expect(output).toContain("start: 同步開始");
  });

  test("log falls back to emojiMap[level]", () => {
    const logger = new LoggerConsole("info", [], {}, emojiMap);
    const { output } = captureConsole(() => logger.info({}, "預設 info emoji"));
    expect(output).toContain("ℹ️");
    expect(output).toContain("info: 預設 info emoji");
  });

  test("退回 emoji", () => {
    const base = new LoggerConsole("info", [], {}, emojiMap).extend("base", {
      emoji: "🌟",
    });
    expectConsoleContains(() => base.info()`A`, {
      out: ["base", "🌟", "info", "A"],
    });
    const level1 = base.extend("level1", { emoji: "🚀" });
    expectConsoleContains(() => level1.info()`B`, {
      out: ["base:level1", "🚀", "info", "B"],
    });
    expectConsoleContains(() => level1.info({ event: "start" })`C`, {
      out: ["base:level1", "🏁", "start", "C"],
    });
    expectConsoleContains(() => level1.warn()`D`, {
      out: ["base:level1", "⚠️", "warn", "D"],
    });
    const level1_n = base.extend("level1_n");
    expectConsoleContains(() => level1_n.info()`E`, {
      out: ["base:level1_n", "🌟", "E"],
    });
  });

  test("template logger supports message formatting", () => {
    const logger = new LoggerConsole("info", [], {}, emojiMap);
    const { output } = captureConsole(() => {
      logger.info({ event: "done", count: 10 })`完成 ${10} 項任務`;
    });
    expect(output).toContain("✅");
    expect(output).toContain(`done: 完成 ${kleur.green("10")} 項任務`);
    expect(output).toContain('"__0":10');
  });

  test("logger.extend adds namespace to path", () => {
    const root = new LoggerConsole("debug", [], {}, emojiMap);
    const syncLogger = root.extend("sync");
    const { output } = captureConsole(() =>
      syncLogger.info({ event: "start" }, "模組開始")
    );
    expect(output).toContain("sync:start: 模組開始");
  });

  test("logger.append merges context without path", () => {
    const root = new LoggerConsole("debug", [], {}, emojiMap);
    const reqLogger = root.append({ traceId: "abc-123" });
    const { output } = captureConsole(() =>
      reqLogger.info({ event: "done" }, "完成")
    );
    expect(output).toContain('"traceId":"abc-123"');
    expect(output).toContain("done: 完成");
  });

  test("logger outputs error stack", () => {
    const err = new Error("爆炸了");
    const logger = new LoggerConsole("debug", [], {}, emojiMap);
    expectConsoleContains(
      () => logger.error({ error: err, event: "error" }, "錯誤"),
      {
        errorOut: ["error", "爆炸了", "錯誤"],
      }
    );
    expectConsoleContains(() => logger.error({}, "錯誤A"), {
      errorOut: ["error", "錯誤A"],
    });
    expectConsoleContains(() => logger.error()`錯誤B`, {
      errorOut: ["error", "錯誤B"],
    });
  });

  test("logger stack 能準確提供出錯位置", () => {
    const logger = new LoggerConsole("debug", [], {}, emojiMap);
    function theMethod(logger: LoggerConsole) {
      logger.error()`錯誤位置測試`;
    }
    const { errorOutput } = captureConsole(() => {
      theMethod(logger);
    });
    const match = /at (.*) /;
    const matches = errorOutput.match(match);
    expect(matches).toBeTruthy();
    const firstMatch = matches ? matches[1] : "";
    expect(firstMatch).toBe("theMethod");
  });

  test("傳輸給 Transport 的 stack 是準確的位置", () => {
    const logger = new LoggerConsole("debug", [], {}, emojiMap);
    function theMethod(logger: LoggerConsole) {
      logger.error()`錯誤位置測試`;
    }
    let stack = "";
    const transport: LogTransport = {
      write(record) {
        stack = record.err?.stack ?? "";
      },
      async [Symbol.asyncDispose]() {},
    };
    logger.attachTransport(transport);
    captureConsole(() => {
      theMethod(logger);
    });
    const match = /at (.*) /;
    const matches = stack.match(match);
    expect(matches).toBeTruthy();
    const firstMatch = matches ? matches[1] : "";
    expect(firstMatch).toBe("theMethod");
  });

  test("使用 RfsTransport", async () => {
    const logger = new LoggerConsole("debug", [], {}, emojiMap);

    const transport = new RfsTransport({
      filename: "test.log",
      rfs: {
        path: "logs",
      },
    });
    logger.attachTransport(transport);
    const { output } = captureConsole(() => {
      logger.info({ event: "start", emoji: "🌟", userId: "abc" }, "啟動");
      logger.error({ error: new Error("爆炸了"), event: "error" }, "錯誤");
    });
    expect(output).toContain("🌟");
    expect(output).toContain("start: 啟動");
    expect(output).toContain('"userId":"abc"');
    await dispose(transport);
    const fs = Bun.file("logs/test.log");
    const text = await fs.text();
    expect(text).toContain('"level":"info"');
    expect(text).toContain('"event":"start"');
    expect(text).toContain('"msg":"啟動"');
    expect(text).toContain('"userId":"abc"');
    expect(text).toContain('"level":"error"');
    expect(text).toContain('"event":"error"');
    expect(text).toContain('"msg":"錯誤"');
    expect(text).toContain('"name":"Error"');
    expect(text).toContain('"message":"爆炸了"');
    await fs.delete();
  });

  test.skipIf(TEST_SKIP_DISCORD_WEBHOOK_TEST ?? true)(
    "使用 DiscordWebhookTransport",
    async () => {
      if (!TEST_LOGGER_DISCORD_WEBHOOK_URL) {
        throw new Error("TEST_LOGGER_DISCORD_WEBHOOK_URL not set");
      }
      const logger = new LoggerConsole("debug", [], {}, emojiMap);

      const transport = new DiscordWebhookTransport({
        webhookUrl: TEST_LOGGER_DISCORD_WEBHOOK_URL,
      });
      logger.attachTransport(transport);
      logger.info({ event: "start", emoji: "🌟", userId: "abc" }, "啟動");
      logger.error(
        { error: new Error("爆炸了"), event: "error", aa: "AA", bb: 123 },
        "錯誤"
      );
      await dispose(transport);
    }
  );
});
