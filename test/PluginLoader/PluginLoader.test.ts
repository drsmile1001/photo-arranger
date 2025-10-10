import { describe, expect, test } from "bun:test";

import { PluginLoader } from "~shared/PluginLoader";
import { buildTestLogger } from "~shared/testkit/TestLogger";

import type { PluginTestServiceMap } from "./fixture/plugins/PluginTestServiceMap";

describe("PluginLoader", () => {
  test("可以載入插件與釋放插件", async () => {
    const logger = buildTestLogger();
    const message: string[] = [];
    const serviceMap = {
      Callback: (msg: string) => {
        message.push(msg);
      },
    };
    const currentDir = import.meta.dir;
    const manager = new PluginLoader<PluginTestServiceMap>(logger, serviceMap, {
      pluginDir: `${currentDir}/fixture/plugins`,
    });
    await manager.load();
    expect(message).toContain("Object plugin initialized");
    expect(message).toContain("Class plugin initialized");
    await manager.dispose();
    expect(message).toContain("Class plugin disposed");
  });
});
