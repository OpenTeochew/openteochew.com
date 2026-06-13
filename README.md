# OpenTeochew

**潮州話開放資料庫** — An open-source language resource platform for Teochew (潮州話).

[openteochew.com](https://openteochew.com)

---

## 關於 / About

OpenTeochew 匯集潮州話辭書、教材的詞條與語料，提供多條件搜索、原文掃描頁面瀏覽，所有資料標明出處，開放使用。支持繁簡中文切換。

OpenTeochew aggregates entries and texts from Teochew dictionaries and textbooks, offering multi-field search, scanned page viewing, and open access to all sources with proper attribution. Supports Traditional/Simplified Chinese toggle.

### 功能 / Features

- **詞條搜索** — 按漢字、PUJ 白話字、DP 潮州話拼音、普通話、English、日本語多條件檢索，結果按來源分組顯示
- **原文掃描** — 逐頁瀏覽字典原冊掃描影像，並附 OCR 文字（原文/校訂對照）
- **語料閱讀** — Markdown 格式的潮州話語料文章，附目錄導航
- **繁簡切換** — 全站 UI 文字與詞條漢字動態轉換為簡體中文
- **開源數據** — 數據 CC0，代碼 MIT

## 技術棧 / Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + Vite 5 + Vue Router (hash mode) + Pinia |
| CSS | Custom design system (CSS variables, `tokens.css`) |
| Backend | Hono + TypeScript + Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Deploy | Cloudflare Workers (custom domain: openteochew.com) |
| Font | [Iansui](https://github.com/ButTaiwan/iansui) (Traditional Chinese) · Noto Sans SC (Simplified Chinese) |

## 項目結構 / Project Structure

```
web/                  # Vue 3 前端
  src/
    pages/            # 頁面組件
    components/       # TopNav
    styles/tokens.css # 全站樣式（CSS 變量 + 響應式）
    router/           # hash-based 路由
    api/              # API client
    stores/           # Pinia stores (search, locale)
    composables/      # useSearch, useSimplified, formatField
backend/              # Hono + Cloudflare Workers
  src/
    index.tsx         # /api/v1 路由 + SPA fallback
    server/
      routes/         # search, entries, sources, articles
      services/       # search, entries
      schemas/        # Zod 驗證
scripts/              # SQL schema + seed + 數據同步
  full-sync.py        # 全量同步 CSV + OCR pages → 本地 D1
```

## 開發 / Development

```bash
# 前端
cd web && npm install && npm run dev

# 後端（自動初始化本地 SQLite）
./dev.sh

# 重建本地數據庫
HW="$HOME/Documents/Code/hokkien-writing/dataset" ./init_dev_db.sh

# 同步數據
./sync_source.sh --local --source-id 1
```

## 構建與部署 / Build & Deploy

```bash
./build.sh      # Build frontend → copy to backend/public
./deploy.sh     # Build + deploy to Cloudflare Workers
```

## 數據來源 / Data Sources

詞條與語料來自以下公開辭書與教材（掃描頁源自維基文庫）：

- Lim Hiong Seng（林雄成）. (1886). *Handbook of the Swatow Vernacular*（汕頭話手冊）
- William Dean（璘為仁）. (1841). *First Lessons in the Tie-chiw Dialect*（潮州話初階）
- Rudolf Lechler; Samuel Wells Williams; William Duffus. (1883). *English-Chinese Vocabulary of the Vernacular Or Spoken Language of Swatow*（英漢汕頭方言口語詞典）
- Adele Marion Fielde（斐姑娘）. (1883). *A Pronouncing and Defining Dictionary of the Swatow Dialect*（汕頭方言音義字典）
- Josiah Goddard（高德）. (1847). *A Chinese and English Vocabulary in the Tie-chiu Dialect*（漢英潮州方言字典）
- 更多來源持續收錄中

## 團隊 / Team

- **Tieⁿ Kiang** — 語言學負責人、汕頭大學教師。負責語料的審訂與終審，確保收錄內容的準確可靠。
- **Lim Tsunhua** — 開發者、某公司 AI 後端工程師。平台架構設計、全棧開發和資料的初步校訂。
- 期待你的加入：[contact@openteochew.com](mailto:contact@openteochew.com)

## 致謝 / Acknowledgements

本項目中部分核心材料與研究成果源自**張堅博士主持的國家社會科學基金研究項目「近代域外潮州方言文獻所見詞彙系統及其歷史演變研究」（25BYY061）**。本開源團隊對此重要支持表示誠摯感謝。

此外，本項目的建設也受益於：

- [Chhoe Taigi](https://chhoe.taigi.info/) — 網站創建的靈感來源，功能設計的重要參考
- [Iansui](https://github.com/ButTaiwan/iansui) — 提供了精美的字體，並正確顯示了 PUJ
- [OpenCode](https://opencode.ai) — AI 輔助開發工具，本站大部分代碼由該工具產生
- [Cloudflare](https://www.cloudflare.com) — 基礎設施託管，提供了極為慷慨的免費額度

## 貢獻 / Contributing

歡迎提交 Issue 和 Pull Request。開發前請閱 [AGENTS.md](AGENTS.md) 了解項目約定。

Contributions are welcome via Issues and Pull Requests. Please read [AGENTS.md](AGENTS.md) for project conventions before development.

## 授權 / License

- **代碼**：[MIT](LICENSE)
- **數據**：CC0

---

Built with care for the Teochew language community.
