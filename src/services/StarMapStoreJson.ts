import { Type as t } from "@sinclair/typebox";
import { Assert } from "@sinclair/typebox/value";

import { type Result, err, ok } from "~shared/utils/Result";

const starMapSchema = t.Record(
  t.String(),
  t.Number({ minimum: 0, maximum: 5 })
);

export type StarMap = typeof starMapSchema.static;

export type ReadError = "NO_STAR_JSON_PATH" | "READ_ERROR";
export type WriteError = "NO_STAR_JSON_PATH" | "WRITE_ERROR";

export class StarMapStoreJson {
  async read(): Promise<Result<StarMap, ReadError>> {
    const starJsonPath = Bun.env.STAR_JSON_PATH;
    if (!starJsonPath) {
      return err("NO_STAR_JSON_PATH");
    }

    try {
      const raw = await Bun.file(starJsonPath).json();
      Assert(starMapSchema, raw);
      return ok(raw);
    } catch (error) {
      return err("READ_ERROR");
    }
  }

  async write(starMap: StarMap): Promise<Result<null, WriteError>> {
    const starJsonPath = Bun.env.STAR_JSON_PATH;
    if (!starJsonPath) {
      return err("NO_STAR_JSON_PATH");
    }

    try {
      const data = JSON.stringify(starMap, null, 2);
      await Bun.write(starJsonPath, data);
      return ok(null);
    } catch (error) {
      return err("WRITE_ERROR");
    }
  }
}
