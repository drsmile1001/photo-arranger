import { expect } from "bun:test";

import type { DeepPartial } from "~shared/utils/TypeHelper";

type Subsetable =
  | {
      [key: string]: unknown;
    }
  | {
      [key: number]: unknown;
    };

export function expectHasSubset<T extends Subsetable>(
  received: T,
  expected: DeepPartial<T>
): void {
  expect(received).toMatchObject(expected);
}

export function expectContainSubset<T extends Subsetable>(
  received: T[],
  expected: DeepPartial<T>
): void {
  let found = false;
  for (const item of received) {
    try {
      expect(item).toMatchObject(expected);
      found = true;
    } catch (error) {}
  }
  if (!found) {
    //使用內建的 toContainEqual 呈現集合落差
    expect(received).toContainEqual(expected as any);
  }
}

export function expectContainSubsets<T extends Subsetable>(
  received: T[],
  expecteds: DeepPartial<T>[]
): void {
  const notMatcheds = new Set(expecteds);
  for (const item of received) {
    for (const expected of expecteds) {
      try {
        expect(item).toMatchObject(expected);
        notMatcheds.delete(expected);
      } catch (error) {}
    }
  }
  if (notMatcheds.size > 0) {
    //使用內建的 toContainEqual 呈現集合落差
    expect(received).toContainEqual(notMatcheds as any);
  }
}
