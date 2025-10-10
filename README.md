# 📸 photo-arranger

> 一個為 **Linux CLI + 開源工具鏈** 設計的輕量化相片整理流程，
> 專注於「**快速挑選、結構清晰、可長期維護**」的數位照片工作流。

---

## ✳️ 專案願景

`photo-arranger` 不是另寫一套龐大的相片管理軟體，而是
**將現有的拍攝與挑選流程模組化，建立可持續運作的資料流。**

重點在於：

- 不依賴資料庫或封閉軟體
- 每張照片的**檔名與所在目錄本身即具語意**
- 支援使用自定義的 qimgv（快速打星標）
- 允許腳本化的匯入、挑選與歸檔

---

## 🧭 工作流概覽

整體流程分為三個主要階段：

```
📥 import → 🗂️ pick → 🏁 archive
```

| 階段        | 功能                                   | 範例目錄結構                               |
| ----------- | -------------------------------------- | ------------------------------------------ |
| **import**  | 原始相機資料直接複製（保留 DCIM 結構） | `/photos/import/DSZ63_0001/DRS_0001.NEF`   |
| **pick**    | 拆分日期、改名、挑選前的中繼階段       | `/photos/pick/20251005/DRS_0001.JPG`       |
| **archive** | 挑選完的最終成果（含原始 RAW）         | `/photos/archive/2025/202510_FukuokaTrip/` |

---

## ⚙️ 流程說明

### 1️⃣ 匯入階段（`photo import`）

將相機或手機內的 **DCIM** 資料夾完整複製至：

```
/home/<user>/pictures/photos/import/
```

結構會保留原始子資料夾（例如 `100DSZ63`, `101DSZ63` 等）。

---

### 2️⃣ 整理階段（`photo arrange`）

**目標：**
修正連續拍攝超過 9999 張導致的檔名迴圈問題，並依據拍攝日期打散。

**執行內容：**

- 將相機的檔名序列自動補 0。
- 解析檔案 EXIF 拍攝時間（CreateDate）。
- 按日期拆分成 `/pick/YYYYMMDD/`。

**範例：**

```
import/100DSZ63/DRS_9999.JPG
import/101DSZ63/DRS_0001.JPG
→ pick/20251005/DRS_09999.JPG
→ pick/20251006/DRS_10001.JPG
```

---

### 3️⃣ 挑選階段（`photo rate`）

開啟自訂版本的 **qimgv**，支援：

- 使用 `Alt+1~5` 為照片打星；
- 星等會即時寫入 `star_ratings.json`；
- 未來版本可考慮寫回 EXIF (`Rating` 標籤)。

範例：

```
pick/20251005/DRS_0001.JPG ★★★★☆
pick/20251005/DRS_0002.JPG ★☆☆☆☆
```

---

### 4️⃣ 篩選與歸檔（`photo archive`）

根據評分或手動挑選的結果，將照片移入最終存檔位置：

```
archive/YYYY/YYYYMM_<主題名稱>/
```

例如：

```
archive/2025/202510_FukuokaTrip/
archive/2025/202510_misc/
```

**規則：**

- 事件型相片：`YYYYMM_EventName`
- 日常生活照：`YYYYMM_misc`
- 長期主題：`archive/topic/<SeriesName>/YYYYMM_Subject`

---

## 🧩 檔案與評分處理策略

| 元件     | 位置                     | 備註           |
| -------- | ------------------------ | -------------- |
| 評分資料 | `pick/star_ratings.json` | qimgv 自動生成 |
| RAW 檔   | `pick/YYYYMMDD/raw/`     | 手動或腳本移動 |
| 最終照片 | `archive/YYYY/...`       | 精選輸出版本   |

**評分更新策略：**

- 由 `qimgv` 寫入 `star_ratings.json`
- CLI 工具可後續：
  - 同步評分 → EXIF
  - 根據星等自動移動檔案

---

## 📦 常見指令（未來計畫）

| 指令                                 | 說明                              |
| ------------------------------------ | --------------------------------- |
| `photo import <path>`                | 複製相機 DCIM 結構到 `import/`    |
| `photo arrange`                      | 修正檔名並按日期拆分              |
| `photo rate`                         | 打開 qimgv 進行挑選               |
| `photo archive merge <range> [name]` | 將多天照片合併成月夾或事件夾      |
| `photo rating sync`                  | 將 star_ratings 寫回 EXIF         |
| `photo backup`                       | 備份 archive 目錄至外部硬碟或 NAS |

---

## 🧠 設計哲學

| 原則       | 說明                                   |
| ---------- | -------------------------------------- |
| 可組合性   | 所有步驟都以 CLI 腳本實作，可單獨執行  |
| 可追蹤性   | 每次動作都有輸出日誌與操作清單         |
| 去資料庫化 | 所有狀態以檔案為中心（EXIF + JSON）    |
| 持續可用   | 即使停用某個工具，整體結構仍然清晰可用 |

---

## 🧰 依賴工具

- **Bun** — 高速 TypeScript 腳本執行環境
- **exiftool-vendored** — 提取與寫入 EXIF 資料
- **date-fns** — 日期格式化
- **qimgv**（自訂版）— 快速瀏覽與打星
- **rsync** / **rclone** — 備份與同步

---

## 🪄 範例：完整流程

```bash
# 1️⃣ 匯入
photo import /run/media/user/Z63/DCIM

# 2️⃣ 整理
photo arrange

# 3️⃣ 挑選
photo rate

# 4️⃣ 歸檔
photo archive merge 20251001-20251007 misc

# 5️⃣ 備份
photo backup /mnt/nas/photos
```
