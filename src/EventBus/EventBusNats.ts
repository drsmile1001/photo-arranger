import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import type { Logger } from "~shared/Logger";
import { AsyncLock } from "~shared/utils/AsyncLock";
import { isErr, tryCatch } from "~shared/utils/Result";
import type { MaybePromise } from "~shared/utils/TypeHelper";

import type { EventBus, EventMap } from "./EventBus";
import type { NatsConnectionManager } from "./NatsConnectionManager";

const decoder = new TextDecoder("utf-8");

const envelopeSchema = t.Object({
  event: t.String(),
  payload: t.Any(),
});

export type Envelope = typeof envelopeSchema.static;

/**
 * 基於 NATS JetStream 的事件總線實作。
 *
 * - 所有事件統一使用 system.events subject 發送。
 * - 採廣播語意：每個模組啟動後註冊 handler，即可收到該事件。
 * - consume loop 僅啟動一次，統一分派事件至註冊的 handler。
 * - 不支援取消註冊（適用後端服務單次啟動、多 handler 常駐）。
 * ⚠️ 本類別採「收到即確認（ack）」策略，代表訊息成功遞送至處理者。
 * 不保證處理器成功執行（handler failure 不會觸發 retry）。
 *
 * 若需實作任務型派工（需確保任務完成才 ack），請改用工作佇列類型 EventBus 實作。
 */
export class EventBusNats<TEventMap extends EventMap>
  implements EventBus<TEventMap>
{
  private readonly handlers = new Map<
    keyof TEventMap,
    Set<(payload: any) => MaybePromise<void>>
  >();

  private readonly consumeLock = new AsyncLock();
  private consumeStarted = false;
  private readonly logger: Logger;

  constructor(
    private readonly manager: NatsConnectionManager,
    baseLogger: Logger
  ) {
    this.logger = baseLogger.extend("EventBusNats");
  }

  async emit<TKey extends keyof TEventMap>(
    name: TKey,
    payload: TEventMap[TKey]
  ): Promise<void> {
    const envelope: Envelope = {
      event: name as string,
      payload,
    };

    const str = JSON.stringify(envelope);
    await this.manager.jetStream.publish("system.events", str);
    this.logger.debug({ event: name as string })`已發送事件`;
  }

  async subscribe<TKey extends keyof TEventMap>(
    name: TKey,
    handler: (payload: TEventMap[TKey]) => MaybePromise<void>
  ): Promise<void> {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }

    set.add(handler); // 自動去重
    this.logger.info({ event: name as string })`註冊事件處理器`;
    this.ensureConsumingLoop();
  }

  private ensureConsumingLoop(): void {
    const _ = this.consumeLock.run(
      () => !this.consumeStarted,
      async () => {
        const consumer = this.manager.consumer;
        const messages = await consumer.consume();
        this.logger.info()`啟動事件消費迴圈`;

        // 展開事件循環處理（非同步處理，不 await）
        const _ = new Promise<void>(async (resolve) => {
          for await (const msg of messages) {
            const msgLogger = this.logger.extend("consume", {
              subject: msg.subject,
              consumer: msg.info.consumer,
              timestampNanos: msg.info.timestampNanos,
            });
            msgLogger.debug()`收到廣播事件`;
            msg.ack(); // 立即確認消息，避免重複處理
            const decodeResult = tryCatch(() => decoder.decode(msg.data));
            if (isErr(decodeResult)) {
              msgLogger.error({
                error: "decode_error",
                raw: msg.data,
              })`事件解碼失敗`;
              continue;
            }
            const parseResult = tryCatch(() => {
              const decoded = JSON.parse(decodeResult.value) as Envelope;
              return decoded;
            });
            if (isErr(parseResult)) {
              msgLogger.error({
                error: "parse_error",
                decoded: decodeResult.value,
              })`事件解析失敗`;
              continue;
            }

            if (!Value.Check(envelopeSchema, parseResult.value)) {
              msgLogger.error({
                event: "decode_error",
                parsed: parseResult.value,
              })`事件格式不正確`;
              continue;
            }
            const envelope = parseResult.value;
            const set = this.handlers.get(envelope.event);
            if (set?.size) {
              this.logger.info({
                event: "handle_event",
                handlers: set.size,
              })`處理事件 ${envelope.event}, 處理器數量: ${set.size}`;

              for (const handler of set) {
                const _ = new Promise<void>(async (resolve) => {
                  try {
                    await handler(envelope.payload);
                  } catch (error) {
                    this.logger.error({
                      error,
                    })`事件處理器錯誤`;
                  }
                  resolve();
                });
              }
            } else {
              this.logger.debug({
                event: envelope.event,
              })`沒有對應的處理器`;
            }
          }

          this.logger.info()`事件消費迴圈結束`;
          resolve();
        });
        this.consumeStarted = true;
      }
    );
  }
}
