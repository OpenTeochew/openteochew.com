# 增量同步设计（Pages + Entries）

## 问题

当前 `full-sync.py` 对 pages 做全量覆盖（DELETE ALL + INSERT）。改一页 OCR → 整个 source 的 pages 全部删除重建。entries 的增量同步（`sync-csv.py`）已解决，但与 pages 变化之间没有联动。

目标：**pages 和 entries 都做增量同步，且 pages 的变化能驱动 entries 的定向更新**。

## 需求

- OCR 修正后只更新受影响的 pages，不全量覆盖
- pages 变化后，只更新受影响页码范围内的 entries
- 手动脚本触发，未来集成到管理平台
- 面向大规模（50+ sources，百万词条）
- 统一脚本，支持 `--local`（本地 SQLite）和 `--remote`（远程 D1 via wrangler）

## 数据流

```
hokkien-writing repo
  ├── markdown (OCR)  ──┐
  └── CSV (entries)   ──┼──→  sync-source.py  ──→  D1 (pages + entries)
                        │
                        └── pages 变化驱动 entries 定向更新
```

entries 的 source of truth 是 CSV，pages 的 source of truth 是 markdown。两者独立读取，但 pages 的 diff 结果作为 entries 的过滤条件。

## 架构

### 同步策略

**Pages：DB Diff**

- 自然键：`(source_id, page_num)`
- 从 DB 读当前 pages → Map
- 解析新 markdown → Map
- Map diff → INSERT / UPDATE / DELETE
- 不需要额外状态或 schema 变更

**Entries：Pages 变化驱动的定向 Diff**

- 先完成 pages 同步，得到 `changed_page_nums`（新增、修改、删除的页码集合）
- 从 CSV 中只筛选 `page_num IN changed_page_nums` 的 entries
- 从 DB 中只读 `page_num IN changed_page_nums` 的 entries
- Map diff → INSERT / UPDATE / DELETE
- 如果 pages 没有变化（`--entries-only` 模式），则全量 diff

```
                    ┌─────────────────┐
                    │  Parse markdown │
                    │  → new_pages    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  DB old_pages   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Map diff pages │
                    │  → SQL + changed_page_nums
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────┐
                    │  Filter CSV & DB entries │
                    │  WHERE page_num IN (...) │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Map diff entries│
                    │  → SQL          │
                    └─────────────────┘
```

### 自然键

| 表   | 自然键                           |
|------|----------------------------------|
| pages | `(source_id, page_num)`          |
| entries | `(puj, han, en, section_title)` |

entries 的自然键与 `sync-csv.py` 一致。

### Diff 算法

```
1. old_map = Map<natural_key, record>  (从 DB)
2. new_map = Map<natural_key, record>  (从新数据)

3. added   = keys in new_map but not old_map → INSERT
4. removed = keys in old_map but not new_map → DELETE
5. modified = keys in both, content differs  → UPDATE
```

### 远程模式

远程 D1 不支持直接 SQL 连接。流程：

1. `wrangler d1 execute --json` 读取 DB 当前数据（pages / entries）
2. 本地 diff + 生成 SQL
3. `wrangler d1 execute --remote --file` 执行增量 SQL

大规模时，读取阶段用 `WHERE source_id = ? AND page_num IN (...)` 限制范围，避免全量传输。

## 脚本接口

### 统一脚本：`sync-source.py`

```bash
# 完整同步（pages + entries 联动）
python3 scripts/sync-source.py \
  --source-id 1 \
  --csv export/books/001_Handbook_of_the_Swatow_Vernacular.csv \
  --md books/001_Handbook_of_the_Swatow_Vernacular.md \
  --hw ~/Documents/Code/hokkien-writing/dataset \
  --local

# 只同步 pages
python3 scripts/sync-source.py --source-id 1 --pages-only --local

# 只同步 entries（全量 diff，不依赖 pages 变化）
python3 scripts/sync-source.py --source-id 1 --entries-only --local

# 远程 D1
python3 scripts/sync-source.py --source-id 1 --remote
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--source-id` | 是 | source ID |
| `--csv` | 否 | CSV 路径（相对 `--hw` 或绝对），不提供则从 SOURCE_CONFIG 推断 |
| `--md` | 否 | Markdown 路径，不提供则从 SOURCE_CONFIG 推断 |
| `--hw` | 否 | hokkien-writing dataset 根目录 |
| `--local` | 否 | 同步到本地 SQLite（默认） |
| `--remote` | 否 | 同步到远程 D1 via wrangler |
| `--pages-only` | 否 | 只同步 pages |
| `--entries-only` | 否 | 只同步 entries（全量 diff） |

### SOURCE_CONFIG

```python
SOURCE_CONFIG = {
    1: {
        "csv": "export/books/001_Handbook_of_the_Swatow_Vernacular.csv",
        "md": "books/001_Handbook_of_the_Swatow_Vernacular.md",
        "slug": "Handbook_of_the_Swatow_Vernacular",
    },
    # 未来新增 source 在此注册
}
```

## 实现细节

### Pages 解析

从 markdown 中按 `<!-- page:N -->` 标记拆分，每段作为一个 page 的 `ocr_text`。与现有 `full-sync.py` 的 `sync_pages()` 逻辑一致，但不做 DELETE ALL，而是 Map diff。

### Entries 解析

与现有 `sync-csv.py` 一致，读取 CSV，解析 `source` 字段得到 section_title。

### Sections 处理

- entries 新增到不存在的 section 时，自动 INSERT section
- entries 全部移除的 section，不自动删除（安全起见，section 删除是破坏性操作）

### 远程模式的 DB 读取

```python
def query_remote_d1(sql, source_id=None):
    # 生成临时 SQL 文件
    # wrangler d1 execute <db> --remote --json --file=...
    # 解析 JSON 输出
    pass
```

### SQL 生成

复用现有 `sync-csv.py` 的 SQL 生成模式（`sql_val`, `sql_num`, `section_subquery`），扩展支持 pages 的 INSERT / UPDATE / DELETE。

### 输出示例

```
Syncing source_id=1
  CSV: export/books/001_Handbook_of_the_Swatow_Vernacular.csv (6172 rows)
  MD:  books/001_Handbook_of_the_Swatow_Vernacular.md

Pages diff:
  DB: 304 pages
  New: 304 pages
  Added: 0, Modified: 3 (pages 12, 45, 67), Deleted: 0

Entries diff (affected pages: [12, 45, 67]):
  DB: 89 entries in range
  CSV: 91 entries in range
  Added: 2, Modified: 4, Deleted: 0

Executing 9 SQL statements on local DB...
Sync complete.
```

## 与现有脚本的关系

| 脚本 | 状态 | 说明 |
|------|------|------|
| `full-sync.py` | **废弃** → 由 `sync-source.py` 替代 | 首次同步等同于所有 pages 和 entries 都是 "added" |
| `sync-csv.py` | **废弃** → 由 `sync-source.py` 替代 | entries-only 模式等价于 `sync-csv.py` 的全量 diff |

迁移完成后删除这两个脚本。

## 边界情况

- **首次同步（DB 为空）**：所有 pages 和 entries 都是 "added"，等价于全量导入
- **CSV 有新 section**：自动 INSERT section，与现有逻辑一致
- **page_num 为 NULL 的 entries**：不在 pages 变化过滤范围内，`--entries-only` 全量 diff 时仍会处理
- **markdown 无 page markers**：跳过 pages 同步，只做 entries
- **wrangler batch size**：D1 单次执行 ~100KB，SQL 分批提交（每批 100 条）
- **并发安全**：脚本不做并发控制，同一 source 同时只能跑一个同步

## 不做的事

- 不改 DB schema（不加 hash 列）
- 不做 CI 自动触发（未来管理平台再做）
- 不自动删除空 section
- 不做 processor 集成（OCR → CSV 生成仍在 hokkien-writing 端完成）

## 未来扩展

- **管理平台 API**：后端 Hono 路由调用 `subprocess.run(["python3", "scripts/sync-source.py", ...])`
- **同步日志**：记录每次同步的统计（added/modified/deleted 数量）到 DB 或日志文件
- **多 source 并行**：不同 source_id 可并行同步，互不影响
- **dry-run 模式**：`--dry-run` 只输出 diff 不执行 SQL
