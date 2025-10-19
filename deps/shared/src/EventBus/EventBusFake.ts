import type { MaybePromise } from "~shared/utils/TypeHelper";

import type { EventBus, EventMap } from "./EventBus";

export class EventBusFake<TEventMap extends EventMap>
  implements EventBus<TEventMap>
{
  public readonly events: Array<{
    name: keyof TEventMap;
    payload: TEventMap[keyof TEventMap];
  }> = [];

  private readonly handlers = new Map<
    keyof TEventMap,
    Set<(payload: any) => MaybePromise<void>>
  >();

  async emit<TKey extends keyof TEventMap>(
    name: TKey,
    payload: TEventMap[TKey]
  ): Promise<void> {
    this.events.push({ name, payload });

    const set = this.handlers.get(name);
    if (set) {
      for (const handler of set) {
        await handler(payload);
      }
    }
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
    set.add(handler);
  }

  clear(): void {
    this.events.length = 0;
  }

  getEmitted<TKey extends keyof TEventMap>(name: TKey): TEventMap[TKey][] {
    return this.events
      .filter(
        (e): e is { name: TKey; payload: TEventMap[TKey] } => e.name === name
      )
      .map((e) => e.payload);
  }
}
