import type { DCIMSeries } from "./DCIMGroupingService";

export interface DCIMSeriesDateArrangeService {
  arrange(series: DCIMSeries): Promise<ArrangeResult>;
}

export interface ArrangeResult {
  arrangement: Arrangement[];
  issues: ArrangeIssue[];
}

export type Arrangement = {
  originPath: string;
  targetPath: string;
  captureTime: Date;
  captureDate: string; // yyyyMMdd
  photoSerial: number;
  overflow: number; // 0 表示無溢出, >0 表示第幾輪
};

export interface ArrangeIssue {
  originPath: string;
  type: PhotoIssueType;
  message: string;
}

export type PhotoIssueType =
  | "FILE_NOT_FOUND"
  | "NO_EXIF_DATA"
  | "READ_FAILED"
  | "INVALID_TIME"
  | "PARSE_FAILED"
  | "DUPLICATE_TARGET";
