import type { Result } from "~shared/utils/Result";
import type { MaybePromise } from "~shared/utils/TypeHelper";

import type { ServiceMap } from "./ServiceMap";

export interface ServiceResolver<T extends ServiceMap> {
  resolve<K extends keyof T>(key: K): T[K];
  toMap(): T;
}

export type Factory<
  T extends ServiceMap,
  Deps extends readonly (keyof T)[],
  R,
> = (deps: { [K in Deps[number]]: T[K] }) => MaybePromise<R>;

export interface ServiceContainer<
  TDeps extends ServiceMap,
  TRegs extends ServiceMap = TDeps,
> extends ServiceResolver<TDeps> {
  /**
   * 註冊同步實例
   * @param key
   * @param instance
   */
  register<K extends string & keyof TRegs>(
    key: K,
    instance: TRegs[K]
  ): ServiceContainer<TDeps & Record<K, TRegs[K]>, Omit<TRegs, K>>;

  /**
   * 註冊同步或異步工廠函數
   * @param key
   * @param instance
   */
  register<
    K extends string & keyof TRegs,
    Deps extends readonly (keyof TDeps)[],
    R extends TRegs[K],
  >(
    key: K,
    deps: Deps,
    factory: Factory<TDeps, Deps, R>
  ): ServiceContainer<TDeps & Record<K, R>, Omit<TRegs, K>>;

  /**
   * 初始化容器
   */
  build(): Promise<Result<void, BuildError>>;

  /**
   * 釋放容器資源
   */
  [Symbol.asyncDispose](): Promise<void>;

  /**
   * 明示釋放資源
   * @returns
   */
  dispose(): Promise<void>;
}

export type BuildError =
  | { type: "DEPENDENCY_CHAIN_ERROR"; path: string[] }
  | { type: "UNRESOLVABLE"; key: string; reason?: unknown };
