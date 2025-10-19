import { test } from "bun:test";

import { SystemTimeFake } from "~shared/SystemTime";

test("SystemTime.Fake", () => {
  const fakeTime = new Date("2023-10-01T00:00:00Z");
  const fakeSystemTime = new SystemTimeFake(fakeTime);

  const now = fakeSystemTime.now();

  if (now.getTime() !== fakeTime.getTime()) {
    throw new Error(
      `Expected ${fakeTime.toISOString()}, but got ${now.toISOString()}`
    );
  }
});
