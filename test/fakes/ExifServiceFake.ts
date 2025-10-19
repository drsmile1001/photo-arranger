import { type Result, err, ok } from "~shared/utils/Result";

import type { Exif, ExifService, ReadError } from "@/services/ExifService";

export class ExifServiceFake implements ExifService {
  private readonly records: Map<string, Result<Exif, ReadError>> = new Map();
  async readExif(filePath: string): Promise<Result<Exif, ReadError>> {
    const record = this.records.get(filePath);
    if (!record) {
      return err({
        type: "FILE_NOT_FOUND",
        message: `No such file: ${filePath}`,
      });
    }
    return record;
  }

  setExif(filePath: string, exif: Exif) {
    this.records.set(filePath, ok(exif));
  }

  setReadError(filePath: string, error: ReadError) {
    this.records.set(filePath, err(error));
  }
}
