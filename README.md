# 📸 photo-arranger

> 以 **Bun + exiftool-vendored + 自訂 qimgv** 為核心，建立「**可腳本化、可追蹤、低耦合**」的相片整理流程。

---

## ✅ 目前已提供的指令

- `import`：從相機/外接裝置匯入 **DCIM** 內容到本機
- `arrange-dcim`：依 **拍攝日期** 與 **DCIM 系列**（如 `100NIKON`）分組，處理 9999 溢位
- `arrange-raw`：將 **有對應 JPG** 的 RAW 移入 `raw/`；無對應 JPG 的 RAW 標記刪除
- `read-exif-bench`：**EXIF 讀取效能**基準測試（一次一張/批次/全開）
- `reject-low-star`：依 `star_ratings.json` 剔除 **低星級 JPG**（搬到 trash）
- `write-star`：把 `STAR_JSON_PATH` 的星等**寫入 JPG EXIF**，並清除 **不存在檔案** 的評分紀錄

---

## 📦 安裝 / 需求

- **Bun**（執行 TypeScript CLI）
- **exiftool-vendored**（EXIF 讀寫）
- **Linux**（開發/測試環境：Fedora）
- 自訂 **qimgv**（提供評分：`star_ratings.json`）
- 建議安裝 `rsync`（匯入/備份可自用）

環境變數：

- `STAR_JSON_PATH`：qimgv 產生的星等檔（例如：`~/.local/share/qimgv/star_ratings.json`）

---

## 🧭 建議工作流

```
📥 import  →  🗂 arrange-dcim  →  🧹 arrange-raw  →  ⭐ qimgv 打星
    →  🚮 reject-low-star（剔除低星 JPG） 或 ✍ write-star（星等回寫 EXIF）
```

---

## 🛠 指令說明與範例

### 1) `import`

從相機或外部裝置匯入 **DCIM** 原始結構到 `import` 目錄。

```bash
photo import /run/media/<user>/<CARD>/DCIM \
  --target ~/pictures/photos/import
```

- 預設 `--target=~/pictures/photos/import`
- **行為**：保留原 DCIM 目錄層級（如 `100NIKON/…`）

---

### 2) `arrange-dcim`

依 **日期** 與 **系列** 整理 DCIM；處理 9999 溢位（跨 `100NIKON` → `101NIKON` 等）。

```bash
photo arrange-dcim ~/pictures/photos/import/<job-folder> \
  --target ~/pictures/photos/pick \
  --yes
```

- 預設 `--target=~/pictures/photos/pick`
- 會輸出**搬移計畫報告**，確認後執行
- 目標資料夾命名（預設）：`YYYYMMDD-<SeriesSuffix>-<FilePrefix>/…`
- 溢位處理：同日同系列、序號回到 0001 時，會自動計數並在檔名中體現（例如 `_1` 或補位字串，依實作版本）

---

### 3) `arrange-raw`

將 RAW 檔與 JPG 關係**正規化**，以便只用 JPG 挑選：

```bash
photo arrange-raw ~/pictures/photos/pick --yes
```

- 規則：
  - **同層**有同名 JPG → 將 RAW 移入該日資料夾的 `raw/`
  - `raw/` 下若 **上層無同名 JPG** → 標記刪除

- 會輸出**計畫報告**（分 `moves` 與 `deletes`，並依相對路徑分組），確認後執行

---

### 4) `read-exif-bench`

測試 EXIF 讀取效能的策略（一次一張 / 批次 / 全開）。

```bash
photo read-exif-bench ~/pictures/photos/import/<job-folder>
```

- 用於評估 `arrange-dcim` 之 EXIF 讀取策略參數（例如 concurrency）

---

### 5) `reject-low-star`

剔除 **低星級 JPG**（搬到 trash），避免挑選階段卡在重複或低質 JPG。

```bash
STAR_JSON_PATH=~/.local/share/qimgv/star_ratings.json \
photo reject-low-star ~/pictures/photos/pick/20251005 \
  --min-level 2 \
  --trash-folder ~/pictures/photos/trash \
  --non-recursive \
  --yes
```

- 來源星等：`STAR_JSON_PATH`
- 預設 `--min-level=2`（接受 2★ 以上，**小於**則剔除）
- 預設 `--trash-folder=~/pictures/photos/trash`
- `--non-recursive`：只處理單層
- 會輸出**報告**：

  ```yaml
  total: 678
  byStarTotal:
    star_2: 123
    star_1: 123
    star_0: 123
  rejects:
    DRS_0546.JPG: 2
    DRS_0547.JPG: 0
  ```

- 實際動作：建立 `${輸入資料夾名稱}_${yyyyMMddHHmmss}` 並搬移 JPG

---

### 6) `write-star`

將 `STAR_JSON_PATH` 的評分 **寫入 JPG EXIF: Rating**，並**刪除不存在檔案**的評分紀錄。
採 **先讀 EXIF 再比對**，**只有變更才寫入**（冪等）。

```bash
STAR_JSON_PATH=~/.local/share/qimgv/star_ratings.json \
photo write-star ~/pictures/photos/pick/20251005 --yes
```

- 僅處理 `<folder>` **底下**、且副檔名為 **JPG/JPEG** 的紀錄
- 會產生兩份報告：
  - 計畫（寫入/刪除/不變）
  - 結果（若有寫入失敗）

- 計畫報告格式：

  ```yaml
  summary:
    toWrite: 2
    toDelete: 1
    noChanged: 1
  toWrite:
    DRS_1234.jpg: "0 -> 1"
    DRS_6789.jpg: "3 -> 4"
  toDelete:
    - DRS_1236.jpg
  noChanged:
    - DRS_1235.jpg
  ```

---

## 🧾 報告輸出（Dump）

多數指令會將「**計畫**」與（必要時的）「**結果**」輸出為 YAML：
路徑預設：`dist/reports/<timestamp>-<subject>.yaml`
（由 `DumpWriterDefault` 管理，輸出同時也會印在 console）

---

## 🔒 安全與風險提示

- **實際動作前皆有計畫報告與確認**（可用 `--yes` 略過）
- `write-star` 對非 JPG 暫**不寫 rating**（保守策略，避免 RAW/HEIF 等寫入引發 sidecar 爭議）
- `reject-low-star` 為**搬移**而非直接刪除；trash 內檔名如碰撞會跳過並告警
- 行為多以**絕對路徑**比對，避免星等與掃描對不上

---

## 🧠 設計準則（當前版）

- **檔案本位**：狀態以「檔案+EXIF+JSON」為中心（可離線、可攜）
- **可組合**：每個步驟 CLI 可單獨執行、可插拔
- **可追蹤**：每次動作輸出**計畫**與**結果**
- **保守執行**：除非明確設 `--yes`，預設詢問

---

## 🔧 之後可能的擴充

- `archive`：將精選結果（含 RAW）轉存至長期檔案系統（`archive/YYYY/…`）
- `rating-sync`：更彈性的 EXIF/sidecar 同步策略（含 RAW/HEIF）
- `backup`：對 `archive/` 做版本化備份（rsync / rclone）
