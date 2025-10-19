import type { Result } from "~shared/utils/Result";

import type { Exif, ReadError } from "./Exif";

export interface ExifService {
  /**
   * 嘗試讀取檔案的 EXIF 資訊。
   * 成功時回傳 Exif，失敗時包含具體錯誤原因。
   */
  readExif(filePath: string): Promise<Result<Exif, ReadError>>;

  /**
   * 嘗試寫入檔案的星等評分。
   * 成功時回傳 void，失敗時包含錯誤。
   */
  writeRating(filePath: string, rating: number): Promise<Result<void, Error>>;
}
