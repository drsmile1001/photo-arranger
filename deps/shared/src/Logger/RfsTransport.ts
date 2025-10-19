import { once } from "events";
import {
  type Generator,
  type Options as RfsOptions,
  RotatingFileStream,
  createStream,
} from "rotating-file-stream";

import type { LogRecord, LogTransport } from "./Logger";

export interface RfsTransportOptions {
  filename: string | Generator;
  rfs?: RfsOptions;
  redactKeys?: string[]; // 欄位遮罩（ctx用）
}

export class RfsTransport implements LogTransport {
  private stream: RotatingFileStream;

  constructor(private opts: RfsTransportOptions) {
    this.stream = createStream(this.opts.filename, {
      ...this.opts.rfs,
    });
  }

  write(rec: LogRecord): void {
    const out: any = {
      ts: new Date(rec.ts).toISOString(),
      level: rec.level,
      path: rec.path.join(":"),
      event: rec.event,
      msg: rec.msg,
    };
    if (rec.ctx && Object.keys(rec.ctx).length) out.ctx = this.redact(rec.ctx);
    if (rec.err) out.err = rec.err;
    this.stream.write(JSON.stringify(out) + "\n");
  }

  async [Symbol.asyncDispose]() {
    this.stream.end();
    await once(this.stream, "finish");
  }

  private redact(ctx: Record<string, unknown>): Record<string, unknown> {
    const keys = this.opts.redactKeys ?? [];
    if (keys.length === 0) return ctx;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ctx)) {
      out[k] = keys.includes(k) ? "[REDACTED]" : v;
    }
    return out;
  }
}
