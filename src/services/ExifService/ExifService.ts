import type { Result } from "~shared/utils/Result";

import type { Exif, ReadError } from "./Exif";

export interface ExifService {
  /**
   * 嘗試讀取檔案的 EXIF 資訊。
   * 成功時回傳 Exif，失敗時包含具體錯誤原因。
   */
  readExif(filePath: string): Promise<Result<Exif, ReadError>>;
}
