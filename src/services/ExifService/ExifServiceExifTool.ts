import { parse } from "date-fns";
import { ExifDateTime, exiftool } from "exiftool-vendored";

import { type Result, err, ok } from "~shared/utils/Result";

import type { Exif, ReadError } from "./Exif";
import { getTime } from "./ExifDateTimeHelper";
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

      const exif: Exif = {
        filePath,
        captureTime: getTime(tags.DateTimeOriginal as ExifDateTime | undefined),
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

  async [Symbol.asyncDispose]() {
    await exiftool.end();
  }
}
