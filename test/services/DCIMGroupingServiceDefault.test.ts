import { describe, expect, test } from "bun:test";

import { DCIMGroupingServiceDefault } from "@/services/DCIMGroupingServiceDefault";

describe("DCIMGroupingServiceDefault", () => {
  test("能根據 DCF 規範正確分組與排序", () => {
    const service = new DCIMGroupingServiceDefault();

    const input = [
      "/media/Z63/DCIM/100NIKON/DSC_0002.JPG",
      "/media/Z63/DCIM/100NIKON/DSC_0001.JPG",
      "/media/Z63/DCIM/101NIKON/DSC_0003.JPG",
      "/media/Z63/DCIM/100NIKON/DSZ_0001.JPG",
    ];

    const result = service.group(input);
    const { seriesList, issues } = result;

    expect(issues.length).toBe(0);
    expect(seriesList.length).toBe(2); // DSC 與 DSZ 兩組

    const nikonDSC = seriesList.find(
      (s) => s.directorySuffix === "NIKON" && s.photoPrefix === "DSC_"
    );
    const nikonDSZ = seriesList.find(
      (s) => s.directorySuffix === "NIKON" && s.photoPrefix === "DSZ_"
    );

    expect(nikonDSC?.photos.length).toBe(3);
    expect(nikonDSZ?.photos.length).toBe(1);

    // 檢查排序
    const serials = nikonDSC!.photos.map((p) => p.fileSerial);
    expect(serials).toEqual([1, 2, 3]);
  });

  test("非 DCF 命名資料夾應標記 matchDCFDirectory=false", () => {
    const service = new DCIMGroupingServiceDefault();

    const input = [
      "/card/DCIM/RAW_IMAGES/DSC_0001.JPG",
      "/card/DCIM/RAW_IMAGES/DSC_0002.JPG",
    ];

    const result = service.group(input);
    expect(result.seriesList.length).toBe(1);

    const [series] = result.seriesList;
    expect(series.matchDCFDirectory).toBeFalse();
    expect(series.directorySuffix).toBe("RAW_IMAGES");
  });

  test("非法檔名應進入 issues 且不影響其他分組", () => {
    const service = new DCIMGroupingServiceDefault();

    const input = [
      "/media/Z63/DCIM/100NIKON/DSC_0001.JPG",
      "/media/Z63/DCIM/100NIKON/BROKEN.JPG",
      "/media/Z63/DCIM/100NIKON/DSC_0002.JPG",
    ];

    const result = service.group(input);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].type).toBe("INVALID_FILE_SERIAL");
    expect(result.seriesList.length).toBe(1);

    const [series] = result.seriesList;
    expect(series.photos.map((p) => p.fileName)).toEqual([
      "DSC_0001.JPG",
      "DSC_0002.JPG",
    ]);
  });

  test("不同 DCF 目錄同 prefix 應被合併為同一 series", () => {
    const service = new DCIMGroupingServiceDefault();

    const input = [
      "/card/DCIM/100NIKON/DSC_0001.JPG",
      "/card/DCIM/101NIKON/DSC_0002.JPG",
      "/card/DCIM/102NIKON/DSC_0003.JPG",
    ];

    const result = service.group(input);
    expect(result.seriesList.length).toBe(1);

    const [series] = result.seriesList;
    expect(series.directorySuffix).toBe("NIKON");
    expect(series.photoPrefix).toBe("DSC_");

    const serials = series.photos.map((p) => p.directorySerial);
    expect(serials).toEqual([100, 101, 102]);
  });

  test("不同資料夾同 suffix 但不同 prefix 應分組", () => {
    const service = new DCIMGroupingServiceDefault();

    const input = [
      "/card/DCIM/100NIKON/DSC_0001.JPG",
      "/card/DCIM/100NIKON/DSZ_0001.JPG",
      "/card/DCIM/101NIKON/DSC_0002.JPG",
    ];

    const result = service.group(input);
    expect(result.seriesList.length).toBe(2);

    const prefixes = result.seriesList.map((s) => s.photoPrefix).sort();
    expect(prefixes).toEqual(["DSC_", "DSZ_"]);
  });
});
