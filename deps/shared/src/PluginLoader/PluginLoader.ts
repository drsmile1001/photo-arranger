import { Value } from "@sinclair/typebox/value";
import { exists, readdir } from "fs/promises";
import { join } from "path";

import type { Logger } from "~shared/Logger";
import type { EmptyMap, ServiceMap } from "~shared/ServiceMap";
import { isErr, tryCatchAsync } from "~shared/utils/Result";

import { type Plugin, pluginSchema } from "./Plugin";

export class PluginLoader<TServiceMap extends ServiceMap = EmptyMap> {
  private readonly plugins: Plugin<TServiceMap>[] = [];
  private readonly logger: Logger;
  private readonly pluginDir: string;
  private readonly serviceMap: TServiceMap;
  constructor(
    logger: Logger,
    serviceMap: TServiceMap,
    options: { pluginDir: string }
  ) {
    this.logger = logger.extend("PluginLoader", {
      emoji: "🔌",
      pluginDir: options.pluginDir,
    });
    this.serviceMap = serviceMap;
    this.pluginDir = options.pluginDir;
  }

  async load(): Promise<void> {
    try {
      const logger = this.logger.extend("load", {
        emoji: "📁",
        pluginDir: this.pluginDir,
      });
      logger.info()`開始載入插件`;
      const dirExist = await exists(this.pluginDir);
      if (!dirExist) {
        logger.warn()`插件目錄 ${this.pluginDir} 不存在，跳過載入`;
        return;
      }
      const entries = await readdir(this.pluginDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
        const fileName = entry.name;
        const filePath = join(this.pluginDir, fileName);
        const fileLogger = logger.extend("pluginFile", {
          emoji: "📄",
          filePath,
          fileName,
        });
        fileLogger.info()`找到檔案 ${fileName}，開始載入`;
        const importResult = await tryCatchAsync(() => import(filePath));
        if (isErr(importResult)) {
          fileLogger.error({
            error: importResult.error,
          })`載入檔案 ${fileName} 時發生錯誤`;
          continue;
        }
        const plugin = importResult.value.default as Plugin<TServiceMap>;
        if (!Value.Check(pluginSchema, plugin)) {
          fileLogger.error()`檔案 ${fileName} 的結構不符合預期，跳過載入`;
          continue;
        }
        fileLogger.info()`檔案 ${fileName} 有插件 ${plugin.name} 開始初始化`;
        const result = await tryCatchAsync(
          async () => await plugin.init(this.logger, this.serviceMap)
        );
        if (isErr(result)) {
          fileLogger.error({
            error: result.error,
          })`載入插件 ${plugin.name} 發生不預期的失敗`;
          continue;
        }
        const initResult = result.value;
        if (isErr(initResult)) {
          if (initResult.error === "SKIP") {
            fileLogger.info({
              event: "skip",
            })`插件 ${plugin.name} 被跳過`;
            continue;
          }
          fileLogger.error()`插件 ${plugin.name} 初始化失敗`;
          continue;
        }
        fileLogger.info({
          event: "success",
        })`插件 ${plugin.name} 載入成功`;
        this.plugins.push(plugin);
      }
      logger.info({
        event: "done",
      })`從 ${this.pluginDir} 載入插件完成，共 ${this.plugins.length} 個插件`;
    } catch (error) {
      this.logger.error({
        error,
      })`載入插件時發生不預期錯誤`;
    }
  }

  async dispose(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        if (!plugin.dispose) continue;
        await plugin.dispose();
        this.logger.info({
          event: "dispose",
          plugin: plugin.name,
        })`釋放插件 ${plugin.name} 成功`;
      } catch (error) {
        this.logger.error({
          error,
        })`釋放插件 ${plugin.name} 時發生錯誤`;
      }
    }
  }
}
