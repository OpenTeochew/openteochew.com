# openteochew.com

潮州話開放資料庫 OpenTeochew — 開源潮州話語言資源平台。

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS |
| 後端 | Hono + TypeScript + Cloudflare Workers |
| 數據庫 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Workers + Assets |

## 開發

```bash
cd web && npm install && npm run dev     # 前端
cd backend && npm install && npm run dev # 後端
```

## 構建

```bash
./build.sh
```

## 文檔

- [設計規範](docs/design/design-spec.md)
- [系統架構](docs/design/architecture.md)
