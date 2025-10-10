import { describe, test } from "bun:test";

import { expectOk } from "~shared/testkit/ExpectResult";
import { expectHasSubset } from "~shared/testkit/ExpectSubset";

import { ExifServiceExifTool } from "@/services/ExifService";

describe("ExifServiceExifTool", () => {
  test("能讀取 EXIF 資料", async () => {
    const service = new ExifServiceExifTool();
    const jpgResult = await service.readExif("test/fixture/DRS_0596.JPG");
    expectOk(jpgResult);
    expectHasSubset(jpgResult.value, {
      filePath: "test/fixture/DRS_0596.JPG",
      captureDate: new Date("2024-08-17T11:26:57.000Z"),
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
      captureDate: new Date("2024-08-17T11:26:57.000Z"),
      cameraModel: "NIKON Z6_3",
      lensModel: "NIKKOR Z 24-120mm f/4 S",
      exposureTime: "1/100",
      aperture: 5,
      iso: 5600,
    });
  });
});
