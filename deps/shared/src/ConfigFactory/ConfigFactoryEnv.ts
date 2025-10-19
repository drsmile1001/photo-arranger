import { type TObject, Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export function buildConfigFactoryEnv<TConfigSchema extends TObject>(
  schema: TConfigSchema
) {
  return () => {
    const input = Value.Clean(schema, Value.Clone(Bun.env));
    const errors = [...Value.Errors(schema, input)];

    if (errors.length > 0) {
      const errorMessages = errors
        .map((e) => `❌ ${e.path}: ${e.message}`)
        .join("\n");

      throw new Error(
        `Environment config validation failed:\n${errorMessages}`
      );
    }

    return Value.Decode(schema, input);
  };
}

const booleanValues = ["true", "1", "yes", "on", "enabled"];

export function envBoolean() {
  return t
    .Transform(t.String())
    .Decode((value) => booleanValues.includes(value.toLowerCase()))
    .Encode((value) => (value ? "true" : "false"));
}

export function envNumber() {
  return t
    .Transform(t.String())
    .Decode((value) => {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Invalid numeric value: ${value}`);
      }
      return num;
    })
    .Encode((value) => String(value));
}
