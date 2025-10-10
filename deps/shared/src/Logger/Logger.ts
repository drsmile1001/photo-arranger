import { enumLiterals } from "~shared/utils/TypeboxHelper";

export const logLevelEnum = enumLiterals([
  "debug",
  "info",
  "warn",
  "error",
  "devlog",
] as const);
export type LogLevel = typeof logLevelEnum.static;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  devlog: 5,
};

export function priority(level: LogLevel) {
  return LEVEL_PRIORITY[level];
}

export interface LoggerContext {
  [key: string]: unknown;
  event?: string;
  emoji?: string;
  error?: unknown;
}

export type TemplateLogger = (
  strings: TemplateStringsArray,
  ...values: any[]
) => void;

export interface Logger {
  readonly level: LogLevel;

  /**
   * 建立子 logger，會增加 logger path 層級並可附帶 context 與 logLevel 覆蓋。
   */
  extend(namespace: string, context?: LoggerContext, level?: LogLevel): Logger;

  /**
   * 附加 context，回傳自己
   */
  append(context: LoggerContext): Logger;

  /** 結構化 log：pino 風格 */
  debug(context: LoggerContext, msg: string): void;
  info(context: LoggerContext, msg: string): void;
  warn(context: LoggerContext, msg: string): void;
  error(context: LoggerContext, msg: string): void;

  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;

  /**
   * 使用 template string 的 logger，會自動將 context 轉為 __#=value 的格式
   */
  debug(context?: LoggerContext): TemplateLogger;
  info(context?: LoggerContext): TemplateLogger;
  warn(context?: LoggerContext): TemplateLogger;
  error(context?: LoggerContext): TemplateLogger;

  /**
   * 開發階段用，無格式限制，輸出醒目 tag
   */
  log(...args: any[]): void;

  /**
   * 新增 log transport，log 會同時寫入多個 transport
   */
  attachTransport(transport: LogTransport): void;

  /**
   * 列出目前所有的 transport
   */
  listTransports(): LogTransport[];

  /**
   * 安全的關閉所有 transport，確保所有 log 都寫入完成，清空 attach 的 transport
   */
  flushTransports(): Promise<void>;
}

export interface LogRecord {
  ts: number;
  level: LogLevel;
  path: string[];
  event?: string;
  msg: string;
  ctx?: Record<string, unknown>;
  err?: ErrorRecord;
}

export type ErrorRecord = {
  name: string;
  message: string;
  stack?: string;
  value?: unknown;
};

export interface LogTransport {
  /**
   * 寫入 log 紀錄
   */
  write(rec: LogRecord): void;

  /**
   * 安全的關閉 transport，確保所有 log 都寫入完成
   */
  [Symbol.asyncDispose](): Promise<void>;
}
