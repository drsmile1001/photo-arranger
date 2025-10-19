import { expect } from "bun:test";

export async function expectToThrow<ThrowError = unknown>(
  fn: () => Promise<unknown>
): Promise<ThrowError | undefined> {
  let returnError: ThrowError | undefined = undefined;
  try {
    await fn();
  } catch (error) {
    returnError = error as ThrowError;
  }
  expect(returnError).toBeDefined();
  return returnError;
}
