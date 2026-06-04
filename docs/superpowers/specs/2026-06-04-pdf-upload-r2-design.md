# PDF 分割上傳 R2 設計

## 目標

Python 腳本將 PDF 分割為 JPG 圖片，經使用者確認後上傳到 Cloudflare R2。

## 約束

- R2 bucket: `openteochew-books`
- 自訂域名: `static.openteochew.com`
- 每本書單獨一個目錄，目錄名用書名 slug（英文，底線連接）
- 上傳方式: Wrangler CLI（`wrangler r2 object put`）

## 腳本：`scripts/upload-pdf.py`

### 參數

```
--pdf <path>       PDF 檔案路徑（必需）
--slug <name>      書名 slug，如 Handbook_of_the_Swatow_Vernacular（必需）
--skip-existing    跳過 R2 已存在的檔案
```

### 流程

1. 驗證 PDF 存在，slug 合法（僅含字母、數字、底線）
2. 用 PyMuPDF（fitz）直接提取 PDF 內嵌圖片（不重新渲染，保留原始品質與體積）
3. 若某頁無內嵌圖片，回退為 200DPI 渲染
4. 儲存到 `tmp/pdf-split/{slug}/`
5. 印出摘要：頁數、檔案大小、解析度
6. 提示使用者確認上傳目標：`openteochew-books/{slug}/NNNN.jpg`
7. 使用者輸入 `y` 後，逐頁呼叫 `wrangler r2 object put`
8. 印出上傳結果統計

### R2 路徑結構

```
openteochew-books/
  Handbook_of_the_Swatow_Vernacular/
    0001.jpg
    0002.jpg
    ...
  Another_Book_Name/
    0001.jpg
    ...
```

存取 URL: `https://static.openteochew.com/{slug}/NNNN.jpg`

### 冪等性

- R2 put 操作本身冪等（覆蓋同名檔案）
- `--skip-existing` 可透過 `wrangler r2 object get` 偵測已存在檔案後跳過

## 依賴變更

- `full-sync.py` 中 `sync_pages()` 的 `image_url` 格式更新為 `https://static.openteochew.com/{slug}/NNNN.jpg`
- `split-pdf.mjs` 保留（仍可用於本地開發），正式環境改用 R2
