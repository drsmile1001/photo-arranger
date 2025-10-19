export type MaybeArray<T> = T | T[];

export function maybeArrayToArray<T>(value: MaybeArray<T>): T[] {
  return Array.isArray(value) ? value : [value];
}

export type MaybePromise<T> = T | Promise<T>;

export type KeyValuePair = Record<string, unknown>;

export type DeepPartial<T> =
  T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
