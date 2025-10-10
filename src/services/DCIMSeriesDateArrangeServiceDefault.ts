import { format, isEqual } from "date-fns";
import path from "node:path";

import { isErr } from "~shared/utils/Result";

import type { DCIMPhoto, DCIMSeries } from "./DCIMGroupingService";
import type {
  ArrangeIssue,
  ArrangeResult,
  Arrangement,
  DCIMSeriesDateArrangeService,
} from "./DCIMSeriesDateArrangeService";
import type { ExifService } from "./ExifService";

export type DCIMPhotoWithDate = DCIMPhoto & { captureDate: Date };

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

  constructor(deps: { exifService: ExifService; outputRoot: string }) {
    this.exifService = deps.exifService;
    this.outputRoot = deps.outputRoot;
  }

  async arrange(series: DCIMSeries): Promise<ArrangeResult> {
    const arrangements: Arrangement[] = [];
    const issues: ArrangeIssue[] = [];

    const exifResults = await Promise.all(
      series.photos.map(async (photo) => {
        const exif = await this.exifService.readExif(photo.fullPath);
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
      if (!exif.value.captureDate || isNaN(exif.value.captureDate.getTime())) {
        issues.push({
          originPath: photo.fullPath,
          type: "INVALID_TIME",
          message: `無效的拍攝時間: ${exif.value.captureDate}`,
        });
        continue;
      }
      valid.push({ ...photo, captureDate: exif.value.captureDate });
    }

    const groupsByDate = valid.reduce((map, photo) => {
      const date = format(photo.captureDate, "yyyyMMdd");
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(photo);
      return map;
    }, new Map<string, DCIMPhotoWithDate[]>());

    for (const [date, photos] of groupsByDate.entries()) {
      photos.sort((a, b) => {
        if (!isEqual(a.captureDate, b.captureDate))
          return a.captureDate.getTime() - b.captureDate.getTime();
        if (a.directorySerial !== b.directorySerial)
          return a.directorySerial - b.directorySerial;
        return a.fileSerial - b.fileSerial;
      });

      let lastPhoto: DCIMPhotoWithDate | null = null;
      let overflow = 0;

      const photoWithOverflow = photos.map((photo) => {
        if (lastPhoto) {
          if (
            (photo.captureDate !== lastPhoto.captureDate ||
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
          captureTime: photo.captureDate,
          photoSerial: photo.fileSerial,
          overflow: photo.overflow,
        });
      }
    }

    return { arrangement: arrangements, issues };
  }
}
