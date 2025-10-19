import { file, write } from "bun";

import { Document, parse } from "yaml";

import type { Logger } from "~shared/Logger";

export type YamlFileOptions<T> = {
  filePath: string;
  fallback: T;
  logger?: Logger;
};

export class YamlFile<T> {
  private readonly filePath: string;
  private readonly fallback: T;
  private readonly logger: Logger | undefined;
  constructor(options: YamlFileOptions<T>) {
    this.filePath = options.filePath;
    this.fallback = options.fallback;
    this.logger = options.logger?.extend("YamlFile", {
      filePath: this.filePath,
    });
  }

  async read(): Promise<T> {
    const yamlFile = file(this.filePath);
    try {
      const raw = await yamlFile.text();
      return parse(raw);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.logger?.warn("找不到檔案，使用預設值");
        return this.fallback;
      }
      this.logger?.error(
        {
          error: err,
        },
        "讀取 YAML 檔案時發生錯誤"
      );
      throw err;
    }
  }

  async write(data: T, transform?: (doc: Document) => void): Promise<void> {
    try {
      const doc = new Document(data);
      if (transform) transform(doc);
      await write(this.filePath, String(doc));
    } catch (error) {
      this.logger?.error(
        {
          error,
        },
        "寫入 YAML 檔案時發生錯誤"
      );
      throw error;
    }
  }
}
