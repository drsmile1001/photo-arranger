export type Exif = {
  /** 檔案完整路徑 */
  filePath: string;

  /** 拍攝時間 */
  captureTime?: Date;

  /** 相機型號 */
  cameraModel?: string;

  /** 鏡頭名稱 */
  lensModel?: string;

  /** 曝光時間 */
  exposureTime?: string;

  /** 光圈 */
  aperture?: number;

  /** ISO */
  iso?: number;

  /** 星等評分，通常為 0-5 */
  rating?: number;

  /** 其他可能用於後續邏輯的欄位 */
  raw?: Record<string, unknown>;
};

export type ReadError =
  | { type: "FILE_NOT_FOUND"; message: string }
  | { type: "READ_FAILED"; message: string }
  | { type: "PARSE_FAILED"; message: string }
  | { type: "NO_EXIF_DATA"; message: string };
