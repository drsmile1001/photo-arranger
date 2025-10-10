import { format, isEqual } from "date-fns";
import path from "node:path";

import type { Logger } from "~shared/Logger";
import { isErr } from "~shared/utils/Result";

import type { DCIMPhoto, DCIMSeries } from "./DCIMGroupingService";
import type {
  ArrangeIssue,
  ArrangeResult,
  Arrangement,
  DCIMSeriesDateArrangeService,
} from "./DCIMSeriesDateArrangeService";
import type { ExifService } from "./ExifService";

export type DCIMPhotoWithDate = DCIMPhoto & { captureTime: Date };

/**
 * 對單一 DCIM series 進行日期分組與 overflow 檢測。
 *
 * 例如：
 *   100NIKON/DSC_0001.JPG → 2024-08-17
 *   100NIKON/DSC_9999.JPG → 2024-08-17
 *   101NIKON/DSC_0001.JPG → 2024-08-17 → overflow +1
 */
export class DCIMSeriesDateArrangeServiceDefault
  implements DCIMSeriesDateArrangeService
{
  private readonly exifService: ExifService;
  private readonly outputRoot: string;
  private readonly logger: Logger;

  constructor(deps: {
    exifService: ExifService;
    outputRoot: string;
    logger: Logger;
  }) {
    this.exifService = deps.exifService;
    this.outputRoot = deps.outputRoot;
    this.logger = deps.logger.extend("DCIMSeriesDateArrangeServiceDefault");
  }

  async arrange(series: DCIMSeries): Promise<ArrangeResult> {
    const logger = this.logger.extend("arrange", {
      series: `${series.directorySuffix}-${series.photoPrefix}`,
    });
    logger.info({
      emoji: "🔄",
    })`開始處理系列 ${series.directorySuffix}-${series.photoPrefix}，共 ${series.photos.length} 張相片`;
    const arrangements: Arrangement[] = [];
    const issues: ArrangeIssue[] = [];
    let readExifCount = 0;
    const totalPhotos = series.photos.length;

    const exifResults = await Promise.all(
      series.photos.map(async (photo) => {
        const exif = await this.exifService.readExif(photo.fullPath);
        readExifCount++;
        this.logger.info({
          emoji: "📷",
          count: readExifCount,
        })`已讀取 ${readExifCount}/${totalPhotos} 張相片的 EXIF 資訊...`;
        return { photo, exif };
      })
    );

    const valid: DCIMPhotoWithDate[] = [];
    for (const { photo, exif } of exifResults) {
      if (isErr(exif)) {
        issues.push({
          originPath: photo.fullPath,
          type: exif.error.type,
          message: exif.error.message,
        });
        continue;
      }
      if (!exif.value.captureTime || isNaN(exif.value.captureTime.getTime())) {
        issues.push({
          originPath: photo.fullPath,
          type: "INVALID_TIME",
          message: `無效的拍攝時間: ${exif.value.captureTime}`,
        });
        continue;
      }
      valid.push({ ...photo, captureTime: exif.value.captureTime });
    }

    const groupsByDate = valid.reduce((map, photo) => {
      const date = format(photo.captureTime, "yyyyMMdd");
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(photo);
      return map;
    }, new Map<string, DCIMPhotoWithDate[]>());

    for (const [date, photos] of groupsByDate.entries()) {
      photos.sort((a, b) => {
        if (!isEqual(a.captureTime, b.captureTime))
          return a.captureTime.getTime() - b.captureTime.getTime();
        if (a.directorySerial !== b.directorySerial)
          return a.directorySerial - b.directorySerial;
        if (a.fileSerial !== b.fileSerial) return a.fileSerial - b.fileSerial;
        return a.extension.localeCompare(b.extension);
      });

      let lastPhoto: DCIMPhotoWithDate | null = null;
      let overflow = 0;

      const photoWithOverflow = photos.map((photo) => {
        if (lastPhoto) {
          if (
            (!isEqual(photo.captureTime, lastPhoto.captureTime) ||
              photo.directorySerial !== lastPhoto.directorySerial) &&
            photo.fileSerial <= lastPhoto.fileSerial
          ) {
            overflow += 1;
          }
        }
        lastPhoto = photo;
        return {
          ...photo,
          overflow,
        };
      });
      const maxOverflow = Math.max(...photoWithOverflow.map((p) => p.overflow));
      const maxOverflowDigits = String(maxOverflow).length;
      const targetPaths = new Set<string>();

      for (const photo of photoWithOverflow) {
        const overflowStr =
          maxOverflow > 0
            ? String(photo.overflow).padStart(maxOverflowDigits, "0")
            : "";
        const fileSerialStr = String(photo.fileSerial).padStart(4, "0");
        const targetPath = path.join(
          this.outputRoot,
          `${date}-${series.directorySuffix}-${series.photoPrefix}`,
          `${photo.prefix}${overflowStr}${fileSerialStr}.${photo.extension}`
        );
        if (targetPaths.has(targetPath)) {
          issues.push({
            originPath: photo.fullPath,
            type: "DUPLICATE_TARGET",
            message: `目標路徑重複: ${targetPath}`,
          });
          continue;
        }
        targetPaths.add(targetPath);
        arrangements.push({
          originPath: photo.fullPath,
          targetPath,
          captureDate: date,
          captureTime: photo.captureTime,
          photoSerial: photo.fileSerial,
          overflow: photo.overflow,
        });
      }
    }

    return { arrangement: arrangements, issues };
  }
}
