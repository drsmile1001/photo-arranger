import { describe, test } from "bun:test";
import { copyFile, mkdir, rm } from "node:fs/promises";

import { expectOk } from "~shared/testkit/ExpectResult";
import { expectHasSubset } from "~shared/testkit/ExpectSubset";

import { ExifServiceExifTool } from "@/services/ExifService";

const tmpDir = "test/tmp/exif";

describe("ExifServiceExifTool", () => {
  test("能讀取 EXIF 資料", async () => {
    const service = new ExifServiceExifTool();
    const jpgResult = await service.readExif("test/fixture/DRS_0596.JPG");
    expectOk(jpgResult);
    expectHasSubset(jpgResult.value, {
      filePath: "test/fixture/DRS_0596.JPG",
      captureTime: new Date("2024-08-17T11:26:57.000Z"),
      cameraModel: "NIKON Z6_3",
      lensModel: "NIKKOR Z 24-120mm f/4 S",
      exposureTime: "1/100",
      aperture: 5,
      iso: 5600,
    });
    const nefResult = await service.readExif("test/fixture/DRS_0596.NEF");
    expectOk(nefResult);
    expectHasSubset(nefResult.value, {
      filePath: "test/fixture/DRS_0596.NEF",
      captureTime: new Date("2024-08-17T11:26:57.000Z"),
      cameraModel: "NIKON Z6_3",
      lensModel: "NIKKOR Z 24-120mm f/4 S",
      exposureTime: "1/100",
      aperture: 5,
      iso: 5600,
    });

    await service[Symbol.asyncDispose]();
  });

  test("可以寫入星等評分", async () => {
    //建立被測試用的暫存檔案
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });

    await copyFile(
      "test/fixture/DRS_0596.JPG",
      `${tmpDir}/DRS_0596_to_write_rating.JPG`
    );

    const service = new ExifServiceExifTool();
    const writeResult = await service.writeRating(
      `${tmpDir}/DRS_0596_to_write_rating.JPG`,
      5
    );
    expectOk(writeResult);
    await service[Symbol.asyncDispose]();
  });
});
