import { Type as t } from "@sinclair/typebox";
import { describe, expect, test } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { buildConfigFactoryEnv, envNumber } from "~shared/ConfigFactory";
import { EventBusNats } from "~shared/EventBus/EventBusNats";
import { NatsConnectionManager } from "~shared/EventBus/NatsConnectionManager";
import { getTestConfig } from "~shared/testkit/TestConfig";
import { withContext } from "~shared/testkit/TestContextRunner";
import { buildTestLogger } from "~shared/testkit/TestLogger";

type TestEventMap = {
  "demo.hello": { message: string };
  "demo.number": { value: number };
};

const getTestNatsConfig = buildConfigFactoryEnv(
  t.Object({
    TEST_NATS_HOST: t.String(),
    TEST_NATS_PORT: envNumber(),
  })
);

const { TEST_SKIP_EVENT_BUS_TEST } = getTestConfig();

describe.skipIf(TEST_SKIP_EVENT_BUS_TEST)("EventBusNats", () => {
  async function buildContext() {
    const logger = buildTestLogger();
    const { TEST_NATS_HOST, TEST_NATS_PORT } = getTestNatsConfig();

    const manager = await NatsConnectionManager.connect(logger, {
      servers: `nats://${TEST_NATS_HOST}:${TEST_NATS_PORT}`,
      moduleId: "test-module",
    });

    const eventBus = new EventBusNats<TestEventMap>(manager, logger);

    return {
      manager,
      eventBus,
      async finalize() {
        await manager[Symbol.asyncDispose]();
      },
    };
  }

  test(
    "emit + subscribe：應該可以收到事件",
    withContext(buildContext, async ({ eventBus }) => {
      const received: any[] = [];

      await eventBus.subscribe("demo.hello", (payload) => {
        received.push(payload);
      });

      await eventBus.emit("demo.hello", { message: "Hello, world!" });

      // 等待事件迴圈處理
      await delay(100);

      expect(received.length).toBe(1);
      expect(received[0]).toEqual({ message: "Hello, world!" });
    })
  );

  test(
    "subscribe 多個事件：應該能分別收到對應事件",
    withContext(buildContext, async ({ eventBus }) => {
      const receivedHello: any[] = [];
      const receivedNumber: any[] = [];

      await eventBus.subscribe("demo.hello", (p) => {
        receivedHello.push(p);
      });
      await eventBus.subscribe("demo.number", (p) => {
        receivedNumber.push(p);
      });

      await eventBus.emit("demo.hello", { message: "hi" });
      await eventBus.emit("demo.number", { value: 42 });

      await delay(100);

      expect(receivedHello.length).toBe(1);
      expect(receivedHello[0]).toEqual({ message: "hi" });

      expect(receivedNumber.length).toBe(1);
      expect(receivedNumber[0]).toEqual({ value: 42 });
    })
  );

  test(
    "subscribe 相同事件多次：應該都會收到",
    withContext(buildContext, async ({ eventBus }) => {
      const a: any[] = [];
      const b: any[] = [];

      await eventBus.subscribe("demo.hello", (p) => {
        a.push(p);
      });
      await eventBus.subscribe("demo.hello", (p) => {
        b.push(p);
      });

      await eventBus.emit("demo.hello", { message: "again" });
      await delay(100);

      expect(a).toEqual([{ message: "again" }]);
      expect(b).toEqual([{ message: "again" }]);
    })
  );
});
