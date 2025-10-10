import { ExifDateTime, exiftool } from "exiftool-vendored";

import { type Result, err, ok } from "~shared/utils/Result";

import type { Exif, ReadError } from "./Exif";
import type { ExifService } from "./ExifService";

export class ExifServiceExifTool implements ExifService {
  async readExif(filePath: string): Promise<Result<Exif, ReadError>> {
    try {
      const tags = await exiftool.read(filePath);
      if (!tags) {
        return err({
          type: "NO_EXIF_DATA",
          message: `無 EXIF 資料: ${filePath}`,
        });
      }

      const capture =
        (tags.CreateDate as ExifDateTime | undefined)?.toDate?.() ??
        (tags.DateTimeOriginal as ExifDateTime | undefined)?.toDate?.();

      const exif: Exif = {
        filePath,
        captureDate: capture,
        cameraModel: tags.Model as string | undefined,
        lensModel: tags.LensModel as string | undefined,
        exposureTime: tags.ExposureTime as string | undefined,
        aperture: tags.FNumber as number | undefined,
        iso: tags.ISO as number | undefined,
        raw: tags as Record<string, unknown>,
      };

      return ok(exif);
    } catch (e) {
      return err({
        type: "READ_FAILED",
        message: `讀取 EXIF 失敗: ${filePath}`,
      });
    }
  }
}
