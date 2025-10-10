import { format } from "date-fns";
import { stringify } from "yaml";

import type { Logger } from "~shared/Logger";
import { YamlFile } from "~shared/utils/YamlFile";

import type { DumpWriter } from "./DumpWriter";

export class DumpWriterDefault implements DumpWriter {
  private readonly logger: Logger;
  private dir: string;
  constructor(logger: Logger, dir = "dist/reports") {
    this.logger = logger.extend("DumpWriterDefault");
    this.dir = dir;
  }

  printableContent(content: unknown): string {
    const yamlContent = stringify(content, {
      indent: 2,
    });
    const lines = yamlContent.split("\n");
    if (lines.length > 30) {
      const firstLines = lines.slice(0, 30).join("\n");
      return `${firstLines}\n... (共 ${lines.length} 行)`;
    }
    return yamlContent;
  }

  async dump<TContent>(subject: string, content: TContent): Promise<void> {
    const trimmedContent = this.printableContent(content);
    this.logger.info({
      event: "dump",
      emoji: "📝",
      subject,
    })`${subject}\n${trimmedContent}`;
    const timestamp = format(new Date(), "yyyyMMddHHmmssSSS");
    const path = `${this.dir}/${timestamp}-${subject}.yaml`;
    const yamlFile = new YamlFile<TContent>({
      filePath: path,
      logger: this.logger,
      fallback: null!,
    });
    await yamlFile.write(content);
    const currentPath = process.cwd();
    const absolutePath = `${currentPath}/${path}`;
    const fileUrl = `file://${absolutePath}`;
    this.logger.info({
      event: "saved",
      emoji: "💾",
    })`已保存至 ${fileUrl}`;
  }
}
