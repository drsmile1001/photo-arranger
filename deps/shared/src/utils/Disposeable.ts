import type { MaybePromise } from "./TypeHelper";

export type Disposeable =
  | {
      dispose: () => MaybePromise<void>;
    }
  | {
      [Symbol.dispose]: () => MaybePromise<void>;
    }
  | {
      [Symbol.asyncDispose]: () => MaybePromise<void>;
    }
  | {
      finalize: () => MaybePromise<void>;
    };

export async function dispose(obj: Disposeable): Promise<void> {
  if (hasDisposeMethod(obj)) {
    await obj.dispose();
  } else if (hasDisposeSymbol(obj)) {
    await obj[Symbol.dispose]();
  } else if (hasAsyncDisposeSymbol(obj)) {
    await obj[Symbol.asyncDispose]();
  } else if (hasFinalizeMethod(obj)) {
    await obj.finalize();
  }
}

export async function callDispose(value: unknown): Promise<boolean> {
  if (!isDisposeable(value)) return false;
  await dispose(value);
  return true;
}

export function isDisposeable(obj: unknown): obj is Disposeable {
  return (
    hasDisposeMethod(obj) ||
    hasDisposeSymbol(obj) ||
    hasAsyncDisposeSymbol(obj) ||
    hasFinalizeMethod(obj)
  );
}

function hasDisposeMethod(
  obj: any
): obj is { dispose: () => MaybePromise<void> } {
  return typeof obj?.dispose === "function";
}

function hasDisposeSymbol(
  obj: any
): obj is { [Symbol.dispose]: () => MaybePromise<void> } {
  return typeof obj?.[Symbol.dispose] === "function";
}

function hasAsyncDisposeSymbol(
  obj: any
): obj is { [Symbol.asyncDispose]: () => MaybePromise<void> } {
  return typeof obj?.[Symbol.asyncDispose] === "function";
}

function hasFinalizeMethod(
  obj: any
): obj is { finalize: () => MaybePromise<void> } {
  return typeof obj?.finalize === "function";
}
