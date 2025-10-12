import { describe, expect, test } from "bun:test";

import { RawArrangeServiceDefault } from "@/services/RawArrangeServiceDefault";

describe("RawArrangeServiceDefault", () => {
  test("同層有對應 JPG → 計畫搬到 raw/", () => {
    const svc = new RawArrangeServiceDefault();
    const plan = svc.planFromList(["/A/DSC_0001.JPG", "/A/DSC_0001.NEF"]);
    expect(plan.moves).toEqual([
      { from: "/A/DSC_0001.NEF", to: "/A/raw/DSC_0001.NEF" },
    ]);
    expect(plan.deletes).toEqual([]);
  });

  test("同層沒有對應 JPG → 建議刪除 RAW", () => {
    const svc = new RawArrangeServiceDefault();
    const plan = svc.planFromList(["/A/DSC_0002.NEF"]);
    expect(plan.moves).toEqual([]);
    expect(plan.deletes).toEqual(["/A/DSC_0002.NEF"]);
  });

  test("已在 raw/，上層有同名 JPG → 保持不動", () => {
    const svc = new RawArrangeServiceDefault();
    const plan = svc.planFromList(["/A/DSC_0003.JPG", "/A/raw/DSC_0003.NEF"]);
    expect(plan.moves).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  test("已在 raw/，上層沒有同名 JPG → 建議刪除", () => {
    const svc = new RawArrangeServiceDefault();
    const plan = svc.planFromList(["/A/raw/DSC_0004.NEF"]);
    expect(plan.moves).toEqual([]);
    expect(plan.deletes).toEqual(["/A/raw/DSC_0004.NEF"]);
  });

  test("副檔名大小寫不敏感", () => {
    const svc = new RawArrangeServiceDefault();
    const plan = svc.planFromList(["/A/DSC_0005.JpG", "/A/DSC_0005.NeF"]);
    expect(plan.moves[0].to).toBe("/A/raw/DSC_0005.NeF");
  });
});
