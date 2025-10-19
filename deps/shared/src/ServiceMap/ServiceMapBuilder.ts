import { dispose } from "~shared/utils/Disposeable";
import type { MaybePromise } from "~shared/utils/TypeHelper";

import type { EmptyMap, ServiceMap } from "./ServiceMap";

export class ServiceMapBuilder<
  TRegistered extends ServiceMap = EmptyMap,
  TServiceMap extends ServiceMap = ServiceMap,
> {
  private readonly registeredKeys: string[] = [];
  private readonly registed: Record<string, unknown> = {};

  private constructor() {}

  get registered(): TRegistered {
    return this.registed as TRegistered;
  }

  static create<
    TServiceMap extends ServiceMap = ServiceMap,
  >(): ServiceMapBuilder<EmptyMap, TServiceMap> {
    return new ServiceMapBuilder<EmptyMap, TServiceMap>();
  }

  from<
    TFromMap extends {
      [K in keyof TRegistered]?: undefined;
    } & {
      [K in keyof TServiceMap]?: MaybePromise<TServiceMap[K]>;
    },
  >(fromMap: TFromMap): ServiceMapBuilder<TRegistered & TFromMap, TServiceMap> {
    for (const [key, value] of Object.entries(fromMap)) {
      this.registeredKeys.push(key);
      this.registed[key] = value;
    }
    return this as ServiceMapBuilder<TRegistered & TFromMap, TServiceMap>;
  }

  register<TName extends keyof TServiceMap>(
    key: Exclude<TName, keyof TRegistered>,
    value: (deps: TRegistered) => TServiceMap[TName]
  ): ServiceMapBuilder<
    TRegistered & { [K in TName]: TServiceMap[TName] },
    TServiceMap
  >;
  register<TName extends keyof TServiceMap>(
    key: Exclude<TName, keyof TRegistered>,
    value: (deps: TRegistered) => Promise<TServiceMap[TName]>
  ): ServiceMapBuilder<
    TRegistered & { [K in TName]: Promise<TServiceMap[TName]> },
    TServiceMap
  >;
  register<TName extends keyof TServiceMap>(
    key: Exclude<TName, keyof TRegistered>,
    value: TServiceMap[TName]
  ): ServiceMapBuilder<
    TRegistered & { [K in TName]: TServiceMap[TName] },
    TServiceMap
  >;
  register(key: string, value: unknown) {
    this.registeredKeys.push(key);
    if (typeof value === "function") {
      try {
        this.registed[key] = value(this.registed as TRegistered);
      } catch (err) {
        throw new Error(`Error executing factory for "${key}": ${String(err)}`);
      }
    } else {
      this.registed[key] = value;
    }
    return this as any;
  }

  async build(): Promise<
    {
      [K in keyof TRegistered]: TRegistered[K] extends Promise<infer R>
        ? R
        : TRegistered[K];
    } & {
      [Symbol.asyncDispose](): Promise<void>;
      dispose(): Promise<void>;
    }
  > {
    const finalMap: Record<string, unknown> = {};

    for (const [key, service] of Object.entries(this.registed)) {
      finalMap[key] = await service;
    }

    const reverseOrder = [...this.registeredKeys].reverse();
    async function cleanup() {
      for (const key of reverseOrder) {
        const instance = finalMap[key];
        await dispose(instance as any);
      }
    }

    return {
      ...finalMap,
      [Symbol.asyncDispose]: cleanup,
      dispose: cleanup,
    } as any;
  }
}
