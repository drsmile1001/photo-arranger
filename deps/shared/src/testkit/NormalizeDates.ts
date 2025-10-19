export function normalizeDates<T>(obj: T): T {
  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeDates) as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = normalizeDates(value);
    }
    return result as unknown as T;
  }
  return obj as unknown as T;
}
