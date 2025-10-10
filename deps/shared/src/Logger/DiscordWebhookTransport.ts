import {
  type LogLevel,
  type LogRecord,
  type LogTransport,
  priority,
} from "./Logger";

export interface DiscordWebhookOptions {
  webhookUrl: string; // https://discord.com/api/webhooks/...
  username?: string; // 顯示用名稱
  levelFloor?: LogLevel; // 僅發送此等級以上，預設 "warn"
  redactKeys?: string[]; // 要遮罩的 ctx 欄位
  maxEmbedFields?: number; // 每則訊息最多顯示多少 ctx 欄位，預設 8
  maxQueueSize?: number; // 佇列上限，預設 500
  maxRetries?: number; // 單封包重試上限，預設 5
  baseDelayMs?: number; // 重試初始延遲，預設 500ms
  sendEmbeds?: boolean; // 是否用 embed 呈現，預設 true
}

type Payload = {
  content: string;
  embeds?: any[];
  retries: number;
};

function toColor(level: LogLevel): number {
  // Discord embed color: 24-bit int
  switch (level) {
    case "error":
      return 0xe53935; // red
    case "warn":
      return 0xfdd835; // yellow
    case "info":
      return 0x1e88e5; // blue
    case "debug":
      return 0x90a4ae; // gray
    case "devlog":
      return 0x6a1b9a; // purple
  }
}

function levelMark(level: LogLevel): string {
  switch (level) {
    case "error":
      return "❌";
    case "warn":
      return "⚠️";
    case "info":
      return "ℹ️";
    case "debug":
      return "🐛";
    case "devlog":
      return "🧪";
  }
}

export class DiscordWebhookTransport implements LogTransport {
  private q: Payload[] = [];
  private sending = false;
  private closed = false;
  private nextAvailableAt = 0; // for rate limit sleep
  private opts: Required<DiscordWebhookOptions>;

  constructor(options: DiscordWebhookOptions) {
    this.opts = {
      username: "Logger",
      levelFloor: "warn",
      redactKeys: ["password", "token", "authorization", "cookie"],
      maxEmbedFields: 8,
      maxQueueSize: 500,
      maxRetries: 5,
      baseDelayMs: 500,
      sendEmbeds: true,
      ...options,
    };
  }

  write(rec: LogRecord): void {
    if (this.closed) return;
    if (priority(rec.level) < priority(this.opts.levelFloor)) return;

    const payloads = this.buildPayloads(rec);
    for (const p of payloads) {
      if (this.q.length >= this.opts.maxQueueSize) {
        // queue overflow → 丟棄最舊一筆以確保新警訊可進來
        this.q.shift();
      }
      this.q.push({ ...p, retries: 0 });
    }

    if (!this.sending) {
      this.sending = true;
      this.drainQueue().finally(() => {
        this.sending = false;
      });
    }
  }

  async [Symbol.asyncDispose]() {
    this.closed = true;
    // 等待佇列送完
    while (this.q.length > 0 || this.sending) {
      await sleep(50);
    }
  }

  healthy(): boolean {
    // 簡化：只要不是 queue 爆滿就回 true；也可加上最近錯誤時間等信號
    return this.q.length < this.opts.maxQueueSize;
  }

  // ---------- 內部：發送循環 ----------
  private async drainQueue() {
    while (this.q.length > 0) {
      const now = Date.now();
      if (now < this.nextAvailableAt) {
        await sleep(this.nextAvailableAt - now);
      }
      const item = this.q[0];
      const ok = await this.sendOnce(item);
      if (ok) {
        this.q.shift();
      } else {
        // 送不出去：重試策略
        item.retries += 1;
        if (item.retries > this.opts.maxRetries) {
          console.error("[DiscordTransport] drop after maxRetries");
          this.q.shift();
        } else {
          const backoff = Math.floor(
            this.opts.baseDelayMs *
              Math.pow(2, item.retries - 1) *
              (1 + Math.random() * 0.2)
          );
          await sleep(backoff);
        }
      }
    }
  }

  private async sendOnce(payload: Payload): Promise<boolean> {
    try {
      const res = await fetch(this.opts.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.opts.username,
          content: payload.content,
          embeds: payload.embeds,
        }),
      });

      if (res.status === 204 || (res.ok && res.status < 300)) {
        return true;
      }

      if (res.status === 429) {
        // 限流：讀取 retry_after
        let retry = 1000;
        try {
          const data = await res.json().catch(() => undefined);
          if (data?.retry_after)
            retry = Math.ceil(Number(data.retry_after) * 1000);
          const ra = res.headers.get("x-ratelimit-reset-after");
          if (ra) retry = Math.ceil(Number(ra) * 1000);
        } catch {
          /* ignore */
        }
        this.nextAvailableAt = Date.now() + retry;
        return false;
      }

      // 其他 4xx/5xx：讓外層 backoff 重試
      console.error(
        "[DiscordTransport] http_error",
        res.status,
        await safeText(res)
      );
      return false;
    } catch (e) {
      console.error("[DiscordTransport] fetch_error", e);
      return false;
    }
  }

  // ---------- 內部：序列化 ----------
  private buildPayloads(rec: LogRecord): Payload[] {
    const pieces: Payload[] = [];
    const head = `${levelMark(rec.level)} [${rec.level.toUpperCase()}] ${rec.path.join(":")}${rec.event ? ":" + rec.event : ""}`;
    const baseContent = clampDiscord(`${head} — ${rec.msg}`, 1900); // 留餘裕
    const embeds = this.opts.sendEmbeds ? this.buildEmbeds(rec) : undefined;

    // 若只有單則就直接回傳
    const size = jsonSize({ content: baseContent, embeds }); // 粗略估算
    if (size <= 1800) {
      pieces.push({ content: baseContent, embeds, retries: 3 });
      return pieces;
    }

    // 超過限制 → 拆分：content 為 head+msg，詳細放次則 embed 片段
    pieces.push({ content: clampDiscord(baseContent, 1800), retries: 3 });
    if (embeds && embeds.length) {
      for (const emb of embeds) {
        // 針對 embed fields 可能過長，再做分塊
        const chunked = chunkEmbed(emb);
        for (const e of chunked)
          pieces.push({ content: "", embeds: [e], retries: 3 }); // content 空字串即可
      }
    }
    return pieces;
  }

  private buildEmbeds(rec: LogRecord): any[] {
    const fields: { name: string; value: string; inline?: boolean }[] = [];

    // 基本欄位
    fields.push({
      name: "path",
      value: code(rec.path.join(":")),
      inline: true,
    });
    if (rec.event)
      fields.push({
        name: "event",
        value: code(String(rec.event)),
        inline: true,
      });
    fields.push({
      name: "ts",
      value: code(new Date(rec.ts).toISOString()),
      inline: true,
    });

    // ctx 節選（遮罩）
    const ctx = redact(rec.ctx ?? {}, this.opts.redactKeys);
    const ctxEntries = Object.entries(ctx);
    const limit = this.opts.maxEmbedFields;
    for (let i = 0; i < ctxEntries.length && i < limit; i++) {
      const [k, v] = ctxEntries[i];
      fields.push({
        name: `ctx.${k}`,
        value: code(stringifySafe(v, 500)),
        inline: false,
      });
    }
    if (ctxEntries.length > limit) {
      fields.push({
        name: "ctx.more",
        value: `… ${ctxEntries.length - limit} more`,
        inline: false,
      });
    }

    // error
    if (rec.err) {
      fields.push({
        name: "error.name",
        value: code(rec.err.name),
        inline: true,
      });
      fields.push({
        name: "error.message",
        value: code(clamp(String(rec.err.message ?? ""), 500)),
        inline: false,
      });
      if (rec.err.stack) {
        fields.push({
          name: "stack",
          value: code(clamp(rec.err.stack, 1800)),
          inline: false,
        });
      }
      if (rec.err.value !== undefined) {
        fields.push({
          name: "error.value",
          value: code(stringifySafe(rec.err.value, 500)),
          inline: false,
        });
      }
    }

    const embed = {
      title: rec.msg.slice(0, 256),
      color: toColor(rec.level),
      fields,
      timestamp: new Date(rec.ts).toISOString(),
    };
    return [embed];
  }
}

// ---------- utils ----------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function redact(obj: Record<string, unknown>, keys: string[]) {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = keys.includes(k) ? "[REDACTED]" : v;
  }
  return out;
}

function stringifySafe(v: unknown, cap = 1000) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return clamp(s, cap);
  } catch {
    return "[Unserializable]";
  }
}

function clamp(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
function code(s: string) {
  return "```\n" + s.replace(/```/g, "ˋˋˋ") + "\n```";
}

function clampDiscord(s: string, max = 1900) {
  // 預留系統字元
  return clamp(s, max);
}
function jsonSize(o: any) {
  try {
    return JSON.stringify(o).length;
  } catch {
    return 0;
  }
}

// 將單一 embed 若過大則拆塊（粗略：按 fields 逐一塞入，超過則切新 embed）
function chunkEmbed(embed: any): any[] {
  const out: any[] = [];
  const base = {
    title: embed.title,
    color: embed.color,
    timestamp: embed.timestamp,
  };
  let cur = { ...base, fields: [] as any[] };
  let curSize = jsonSize(cur);

  for (const f of embed.fields ?? []) {
    const fSize = jsonSize(f);
    if (curSize + fSize > 5500 || (cur.fields as any[]).length >= 20) {
      // 維持保守界限
      out.push(cur);
      cur = { ...base, fields: [] };
      curSize = jsonSize(cur);
    }
    (cur.fields as any[]).push(f);
    curSize += fSize;
  }
  out.push(cur);
  return out;
}
