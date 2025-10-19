import type { ExifDateTime } from "exiftool-vendored";

const RAW_BASIC_RE = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;

/**
 * 將 ExifDateTime 轉為 JS Date。
 * 規則：
 * 1) 若 rawValue = "YYYY:MM:DD HH:mm:ss" 且具 tzoffsetMinutes，使用 raw + tzoffsetMinutes 建立正確的 UTC 時間。
 * 2) 否則 fallback 使用 time.toDate()。
 * 3) 無效資料回傳 undefined。
 */
export function getTime(
  time: ExifDateTime | undefined | string
): Date | undefined {
  if (!time) return undefined;
  // ExifDateTime 提供 isValid，但仍保底判斷
  if (typeof time === "string") {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) return d;
    return undefined;
  }
  if (!time.isValid) return undefined;

  const raw = time.rawValue as string | undefined;
  const tz = time.tzoffsetMinutes as number | undefined;

  // 匹配最常見無時區的 EXIF 字串：YYYY:MM:DD HH:mm:ss
  const m = raw ? RAW_BASIC_RE.exec(raw) : null;

  if (m && typeof tz === "number" && Number.isFinite(tz)) {
    // 以「本地時間 = rawValue 的數字」+「tzoffsetMinutes」計算真正 UTC 時間
    // 例：raw=2025:07:23 18:26:02 且 tz=+480(UTC+8)
    //     本地時間(UTC+8) 18:26:02 對應 UTC = 10:26:02
    const year = Number(m[1]);
    const month = Number(m[2]); // 1-12
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(hour) &&
      Number.isFinite(minute) &&
      Number.isFinite(second)
    ) {
      // 先當作「目標時區的本地時間」建立 UTC 毫秒，再扣掉偏移，得到正確的 UTC 時間點
      const baseUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
      const realUtcMs = baseUtcMs - tz * 60 * 1000;
      const d = new Date(realUtcMs);
      if (!Number.isNaN(d.getTime())) return d;
      return undefined;
    }
  }

  // fallback：交給 exiftool 的內建轉換
  try {
    const d = time.toDate?.();
    if (d && !Number.isNaN(d.getTime())) return d;
  } catch {
    // ignore
  }
  return undefined;
}
