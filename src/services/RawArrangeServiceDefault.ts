import path from "node:path";

import { rawExtensions } from "@/constants";
import type { ArrangePlan } from "@/types";

import type { RawArrangeService } from "./RawArrangeService";

function lc(p: string) {
  return p.toLowerCase();
}
function extOf(p: string) {
  return lc(path.extname(p));
}
function baseOf(p: string) {
  return path.basename(p, path.extname(p));
}
function dirOf(p: string) {
  return path.dirname(p);
}

export class RawArrangeServiceDefault implements RawArrangeService {
  planFromList(filePaths: string[]) {
    const plan: ArrangePlan = { moves: [], deletes: [] };

    // 建立 lowercased path 索引（O(1) 查詢）
    const allLower = new Set(filePaths.map(lc));

    // 針對所有 RAW 路徑
    for (const rawPath of filePaths) {
      const ext = extOf(rawPath);
      if (!rawExtensions.includes(ext as any)) continue;

      const dir = dirOf(rawPath);
      const parentDirName = path.basename(dir).toLowerCase();
      const nameNoExt = baseOf(rawPath); // 不含副檔名
      const fileName = path.basename(rawPath);

      // 檢查相對應 JPG/JPEG 是否存在（同層或上一層）
      const jpgAt = (d: string) => {
        const c1 = lc(path.join(d, `${nameNoExt}.jpg`));
        const c2 = lc(path.join(d, `${nameNoExt}.jpeg`));
        return allLower.has(c1) || allLower.has(c2);
      };

      if (parentDirName === "raw") {
        // 已在 raw/ 之下 → 檢查「上一層資料夾」是否有同名 JPG/JPEG
        const parent = dirOf(dir);
        if (!jpgAt(parent)) {
          // 上層沒有同名 JPG → 標記刪除（代表該 RAW 沒有對應 JPG，被視為可清理）
          plan.deletes.push(rawPath);
        }
        // 若存在對應 JPG → 保持不動
      } else {
        // 不在 raw/ → 檢查同層是否有 JPG/JPEG
        if (jpgAt(dir)) {
          // 有 JPG → 計畫搬到 raw/ 子資料夾
          const to = path.join(dir, "raw", fileName);
          plan.moves.push({ from: rawPath, to });
        } else {
          // 無 JPG → 標記刪除（代表該 RAW 不會參與挑選流程）
          plan.deletes.push(rawPath);
        }
      }
    }

    return plan;
  }
}
