import { expect } from "bun:test";

import {
  type Result,
  type ResultErr,
  type ResultOk,
} from "~shared/utils/Result";

export function expectOk<TValue = unknown, TError = unknown>(
  result: Result<TValue, TError>
): asserts result is ResultOk<TValue> {
  expect(result).toMatchObject({
    ok: true,
  });
}

export function expectValue<TValue = unknown, TError = unknown>(
  result: Result<TValue, TError>,
  value: TValue
): asserts result is ResultOk<TValue> {
  expect(result).toMatchObject({
    ok: true,
    value,
  });
}

export function expectError<TValue = unknown, TError = unknown>(
  result: Result<TValue, TError>
): asserts result is ResultErr<TError> {
  expect(result).toMatchObject({
    ok: false,
  });
}

export function expectErrorValue<TValue = unknown, TError = unknown>(
  result: Result<TValue, TError>,
  error: TError
): asserts result is ResultErr<TError> {
  expect(result).toMatchObject({
    ok: false,
    error,
  });
}
