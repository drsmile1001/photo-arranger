import { file } from "bun";

import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { type Result, err, ok } from "./Result";

export const appInfoSchema = t.Object({
  name: t.String(),
  version: t.String(),
  description: t.String(),
});

export type AppInfo = typeof appInfoSchema.static;

export async function getAppInfo(): Promise<Result<AppInfo>> {
  const packageJson = await file("./package.json").json();
  const cleaned = Value.Clean(appInfoSchema, packageJson);
  const errors = [...Value.Errors(appInfoSchema, cleaned)];
  if (errors.length > 0) {
    return err();
  }
  return ok(cleaned as AppInfo);
}
