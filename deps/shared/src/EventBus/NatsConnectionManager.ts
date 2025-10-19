import {
  AckPolicy,
  type Consumer,
  DeliverPolicy,
  type JetStreamClient,
  jetstream,
  jetstreamManager,
} from "@nats-io/jetstream";
import { type NatsConnection, connect } from "@nats-io/transport-node";

import type { Logger } from "~shared/Logger";

export type NatsConnectionConfig = {
  servers: string;
  moduleId: string;
};

const STREAM_NAME = "SYSTEM_EVENTS";
const STREAM_SUBJECT = "system.events";

export class NatsConnectionManager {
  private readonly logger: Logger;
  private readonly config: NatsConnectionConfig;

  #nc!: NatsConnection;
  #js!: JetStreamClient;
  #consumer!: Consumer;

  // 用於外部 publish 使用
  get jetStream(): JetStreamClient {
    return this.#js;
  }

  // 用於外部 consume 使用
  get consumer(): Consumer {
    return this.#consumer;
  }

  // 可選提供給觀察用途
  get connection(): NatsConnection {
    return this.#nc;
  }

  private constructor(logger: Logger, config: NatsConnectionConfig) {
    this.logger = logger.extend("NatsConnectionManager", {
      servers: config.servers,
      moduleId: config.moduleId,
    });
    this.config = config;
  }

  static async connect(
    baseLogger: Logger,
    config: NatsConnectionConfig
  ): Promise<NatsConnectionManager> {
    const manager = new NatsConnectionManager(baseLogger, config);
    await manager.initialize();
    return manager;
  }

  private async initialize() {
    const { servers, moduleId } = this.config;

    this.logger.info({ event: "start" })`建立 NATS 連線: ${servers}`;

    this.#nc = await connect({ servers });
    const jsm = await jetstreamManager(this.#nc);
    this.#js = jetstream(this.#nc);

    this.logger.info({ event: "connected", emoji: "📡" })`NATS 已連線`;

    try {
      await jsm.streams.info(STREAM_NAME);
    } catch {
      await jsm.streams.add({
        name: STREAM_NAME,
        subjects: [STREAM_SUBJECT],
      });
      this.logger.info({
        event: "stream_created",
        emoji: "🌀",
      })`建立 Stream: ${STREAM_NAME}`;
    }

    const durable = `eventbus-${moduleId}`;
    try {
      await jsm.consumers.info(STREAM_NAME, durable);
    } catch {
      await jsm.consumers.add(STREAM_NAME, {
        durable_name: durable,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.New,
        filter_subject: STREAM_SUBJECT,
      });
      this.logger.info({
        event: "consumer_created",
        emoji: "📥",
      })`建立 Consumer: ${durable}`;
    }

    this.#consumer = await this.#js.consumers.get(STREAM_NAME, durable);

    this.logger.info()`模組 ${moduleId} 已完成 SYSTEM_EVENTS 初始化`;
  }

  async [Symbol.asyncDispose]() {
    try {
      await this.#nc.drain();
      this.logger.info({ event: "drained", emoji: "🔌" })`NATS 連線已安全關閉`;
    } catch (err) {
      this.logger.error({
        event: "drain_error",
        error: err,
      })`關閉 NATS 時發生錯誤`;
    }
  }
}
