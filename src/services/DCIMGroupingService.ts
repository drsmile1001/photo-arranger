export interface DCIMGroupingService {
  group(filePaths: string[]): DCIMGroupResult;
}

export interface DCIMGroupResult {
  seriesList: DCIMSeries[];
  issues: DCIMGroupIssue[];
}

/**
 * 單一 series 代表同一相機與同一命名前綴 (photoPrefix)
 * 例如：
 * - 100NIKON/DSC_0001.JPG → series=NIKON, prefix=DSC
 * - 101NIKON/DSZ_0001.JPG → series=NIKON, prefix=DSZ
 *   → 將拆成不同 series
 */
export interface DCIMSeries {
  directorySuffix: string; // 100NIKON → NIKON, other → other
  photoPrefix: string; // DSC_0001.JPG → DSC
  matchDCFDirectory: boolean;
  photos: DCIMPhoto[];
}

export interface DCIMPhoto {
  fullPath: string;
  fileName: string;
  extension: string;
  directorySuffix: string; // NIKON
  directorySerial: number; // 100 → 100, other → 0
  prefix: string; // DSC
  fileSerial: number; // DSC_0001.JPG → 1
}

export interface DCIMGroupIssue {
  filePath: string;
  type: "INVALID_FILE_SERIAL" | "INVALID_DIRECTORY";
  reason: string;
}
