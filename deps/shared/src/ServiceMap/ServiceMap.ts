export type ServiceMap = Record<string, unknown>;
export type EmptyMap = {};

export async function resolveMap<T extends ServiceMap>(
  map: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const resolvedEntries = await Promise.all(
    Object.entries(map).map(async ([key, value]) => {
      const resolved = await value;
      return [key, resolved] as const;
    })
  );

  const result = Object.fromEntries(resolvedEntries) as {
    [K in keyof T]: Awaited<T[K]>;
  };

  return result;
}
