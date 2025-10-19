import type { MaybePromise } from "~shared/utils/TypeHelper";

export type EventMap = Record<string, EventPayload>;
export type EventPayload = Record<string, unknown>;

export interface EventBus<TEventMap extends EventMap> {
  emit<TKey extends keyof TEventMap>(
    name: TKey,
    payload: TEventMap[TKey]
  ): Promise<void>;
  
  subscribe<TKey extends keyof TEventMap>(
    name: TKey,
    handler: (payload: TEventMap[TKey]) => MaybePromise<void>
  ): Promise<void>;
}
