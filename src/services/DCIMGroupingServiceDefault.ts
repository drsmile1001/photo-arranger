import path from "node:path";

import type {
  DCIMGroupIssue,
  DCIMGroupResult,
  DCIMGroupingService,
  DCIMPhoto,
  DCIMSeries,
} from "./DCIMGroupingService";

export const dcfFileNameRegex = /^([A-Z0-9_]{3,5})(\d{4})\.[A-Z0-9]+$/i;

/**
 * 實作 Nikon / Canon / Sony 等 DCF 結構的分組邏輯。
 * 基本假設：
 * - DCF directory 格式為 NNNAAAAA (100NIKON)
 * - 檔案格式為 PREFIX####.EXT (DSC_1234.JPG)
 * - 若同一資料夾內有混雜前綴 (如 DSC, DSZ)，則分拆為不同 series
 */
export class DCIMGroupingServiceDefault implements DCIMGroupingService {
  group(filePaths: string[]): DCIMGroupResult {
    const seriesMap = new Map<string, DCIMSeries>();
    const issues: DCIMGroupIssue[] = [];

    for (const fullPath of filePaths) {
      const fileName = path.basename(fullPath);
      const extension = path.extname(fileName).replace(".", "").toUpperCase();
      const dirName = path.basename(path.dirname(fullPath));

      // 判斷資料夾是否符合 DCF 命名
      const match = /^(\d{3})([A-Z0-9_]{3,5})$/.exec(dirName);
      const matchDCFDirectory = !!match;
      const directorySerial = match ? parseInt(match[1], 10) : 0;
      const directorySuffix = match ? match[2] : dirName;

      // 嘗試解析檔名前綴與流水號
      const nameMatch = dcfFileNameRegex.exec(fileName);
      if (!nameMatch) {
        issues.push({
          filePath: fullPath,
          type: "INVALID_FILE_SERIAL",
          reason: `檔名不符合 DCF 命名規範: ${fileName}`,
        });
        continue;
      }

      const prefix = nameMatch[1];
      const fileSerial = parseInt(nameMatch[2], 10);

      const key = `${directorySuffix}::${prefix}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          directorySuffix,
          photoPrefix: prefix,
          matchDCFDirectory,
          photos: [],
        });
      }

      const photo: DCIMPhoto = {
        fullPath,
        fileName,
        extension,
        directorySuffix,
        directorySerial,
        prefix,
        fileSerial,
      };

      seriesMap.get(key)!.photos.push(photo);
    }

    const seriesList = Array.from(seriesMap.values()).map((s) => ({
      ...s,
      photos: s.photos.sort((a, b) =>
        a.directorySerial !== b.directorySerial
          ? a.directorySerial - b.directorySerial
          : a.fileSerial - b.fileSerial
      ),
    }));

    return { seriesList, issues };
  }
}
