import {
  type TLiteral,
  type TSchema,
  type TUnion,
  Type as t,
} from "@sinclair/typebox";

export function describe<T extends TSchema>(schema: T, description: string): T {
  schema.description = description;
  return schema;
}

export function enumLiterals<
  T extends readonly (readonly [string, string] | string)[],
>(
  description: string,
  defs: T
): TUnion<
  [
    ...{
      [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : TLiteral<T[K][0]>;
    },
  ]
>;
export function enumLiterals<
  T extends readonly (readonly [string, string] | string)[],
>(
  defs: T
): TUnion<
  [
    ...{
      [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : TLiteral<T[K][0]>;
    },
  ]
>;
export function enumLiterals<
  T extends readonly (readonly [string, string] | string)[],
>(
  arg1: string | T,
  arg2?: T
): TUnion<
  [
    ...{
      [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : TLiteral<T[K][0]>;
    },
  ]
> {
  const defs = Array.isArray(arg1) ? arg1 : arg2!;
  const description = typeof arg1 === "string" ? arg1 : undefined;
  return t.Union(
    defs.map((def) =>
      typeof def === "string"
        ? t.Literal(def)
        : t.Literal(def[0], { description: def[1], title: def[1] })
    ),
    {
      description,
    }
  ) as any;
}
