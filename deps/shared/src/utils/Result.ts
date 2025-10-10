export type Result<T = void, E = void> = ResultOk<T> | ResultErr<E>;

export type ResultOk<T = void> = {
  ok: true;
  value: T;
};

export type ResultErr<E = void> = {
  ok: false;
  error: E;
};

export function ok<T>(value: T): ResultOk<T>;
export function ok(): ResultOk<void>;
export function ok<T>(value?: T): ResultOk<T> | ResultOk<void> {
  return { ok: true, value: value as T };
}
export function err<E>(value: E): ResultErr<E>;
export function err(): ResultErr<void>;
export function err<E>(value?: E): ResultErr<E> | ResultErr<void> {
  return { ok: false, error: value as E };
}

export function isOk<T, E>(result: Result<T, E>): result is ResultOk<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is ResultErr<E> {
  return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  } else {
    throw new Error(`無法解包 Result: ${JSON.stringify(result.error)}`);
  }
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T) {
  return result.ok ? result.value : fallback;
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

export function tryCatch<T, E>(
  fn: () => T,
  onError?: (e: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    if (onError) {
      return err(onError(e));
    }
    return err(e as E);
  }
}

export async function tryCatchAsync<T, E>(
  fn: () => Promise<T>,
  onError?: (e: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (onError) {
      return err(onError(e));
    }
    return err(e as E);
  }
}
