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

**Pages：Content Hash + DB Diff**

- pages 表新增 `content_hash TEXT` 列，存储 `ocr_text` 的 SHA-256 前 16 字符
- 同步时只需从 DB 读 `(page_num, content_hash)`，不读 `ocr_text`（大字段）
- 解析新 markdown → 每页算 hash → 与 DB hash 比对
- 只有 hash 不同的页才生成 UPDATE（写入新 `ocr_text` + 新 `content_hash`）
- 新增的页生成 INSERT，消失的页生成 DELETE

**Entries：Pages 变化驱动的模糊匹配 Diff**

- 先完成 pages 同步，得到 `changed_page_nums`（新增、修改、删除的页码集合）
- 从 CSV 中只筛选 `page_num IN changed_page_nums` 的 entries
- 从 DB 中只读 `page_num IN changed_page_nums` 的 entries
- 按 page_num 分组，组内做多字段编辑距离模糊匹配
- 贪婪匹配：相似度 > 阈值 → UPDATE，未匹配的 CSV 行 → INSERT，未匹配的 DB 行 → DELETE
- 如果 pages 没有变化（`--entries-only` 模式），则按 section 分组做全量模糊匹配

```
                    ┌─────────────────┐
                    │  Parse markdown │
                    │  → new_pages    │
                    │  (compute hash) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ DB: SELECT      │
                    │ page_num,       │
                    │ content_hash    │
                    │ (不读 ocr_text)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Hash diff      │
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

entries 不使用固定自然键，改用**多字段模糊匹配**（见下文）。

### Content Hash（Pages）

pages 表新增 `content_hash TEXT` 列：

```sql
ALTER TABLE pages ADD COLUMN content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_pages_hash ON pages(source_id, content_hash);
```

- hash 算法：`sha256(ocr_text)[:16]`（前 16 字符，16 进制）
- 首次同步（回填）：全量扫描 pages 表，为每条记录计算并写入 hash
- 增量同步时：只读 `(page_num, content_hash)`，避免传输大量 `ocr_text`

### Diff 算法

**Pages diff（基于 hash）**：

```
1. old_map = Map<page_num, content_hash>  (从 DB，不读 ocr_text)
2. new_map = Map<page_num, content_hash>  (从新 markdown 计算hash)

3. added   = page_nums in new_map but not old_map → INSERT (ocr_text + content_hash)
4. removed = page_nums in old_map but not new_map → DELETE
5. modified = page_nums in both, hash differs     → UPDATE (ocr_text + content_hash)
```

**Entries diff（基于多字段模糊匹配，按页分组）**：

问题：entries 没有稳定的自然键。OCR 修正可能改变 puj/han/en 等字段值，导致固定 key 失效。

解决：用**多字段编辑距离**做模糊匹配，按 `page_num` 分组缩小搜索空间。

```
1. 按页分组：只处理 changed_page_nums 范围内的 entries
2. 对每个 page_num：
   a. csv_group = 该页的 CSV 行
   b. db_group = 该页的 DB 行
   c. 对每个 csv_row，计算与所有 db_row 的相似度得分
   d. 贪婪匹配（Hungarian-style）：最高分 > threshold → matched → 比对差异 → UPDATE
   e. csv_row 无匹配 → INSERT
   f. db_row 未被匹配 → DELETE
```

**相似度计算**：

对 CSV 行和 DB 行都有的非空字段，计算归一化编辑距离（Levenshtein ratio），取加权平均：

```python
MATCH_FIELDS = [
    ("han",       2.0),   # 汉字
    ("han_orig",  2.0),   # 原文汉字
    ("puj",       2.0),   # 罗马字——改动少但区分度高
    ("puj_orig",  2.0),   # 原文罗马字同理
    ("en",        2.0),   # 英文释义
    ("en_orig",   2.0),   # 原文英文
    # 未来可扩展：dp, mandarin, ja ...
]
```

权重设计理由：
- 所有字段统一权重 2.0：OCR 修正通常只改一两个字，任何字段的一个字符差异都可能意味着不同的词。统一权重避免因权重差异导致某些字段的微小变化被淹没。

**匹配阈值**：默认 0.8，可通过 `--match-threshold` 参数调整。

**性能分析**：

- 预过滤：按 `page_num` 分组，每页通常 10-30 个词条
- 每组比较次数：O(n × m)，n=m=30 时 900 次
- 即使一次同步影响 100 页，总比较次数 ~9 万次，秒级完成
- 新增页（DB 中不存在）：跳过匹配，直接全 INSERT
- 删除页（新 markdown 中不存在）：跳过匹配，直接全 DELETE

### 远程模式

远程 D1 不支持直接 SQL 连接。流程：

1. `wrangler d1 execute --json` 读取 DB 当前 pages 的 `(page_num, content_hash)`（轻量，不传 ocr_text）
2. 本地 hash diff + 生成 SQL
3. `wrangler d1 execute --remote --file` 执行增量 SQL

entries 读取同理，用 `WHERE page_num IN (...)` 限制范围。

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
| `--match-threshold` | 否 | entries 模糊匹配阈值（默认 0.8） |

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

### Entries 匹配算法

按页分组后的贪婪匹配流程：

```python
def match_entries(csv_group, db_group, threshold=0.8):
    # 构建得分矩阵
    scores = {}
    for i, csv_row in enumerate(csv_group):
        for j, db_row in enumerate(db_group):
            scores[(i, j)] = similarity(csv_row, db_row)

    # 贪婪匹配：每轮取最高分
    matched = []        # [(csv_idx, db_idx, score)]
    used_csv = set()
    used_db = set()

    for _ in range(min(len(csv_group), len(db_group))):
        best = max(
            ((i, j, scores[(i, j)])
             for i in range(len(csv_group)) if i not in used_csv
             for j in range(len(db_group)) if j not in used_db),
            key=lambda x: x[2],
            default=None,
        )
        if best is None or best[2] < threshold:
            break
        matched.append(best)
        used_csv.add(best[0])
        used_db.add(best[1])

    # 分类
    updates = [(csv_group[i], db_group[j]) for i, j, _ in matched]
    inserts = [csv_group[i] for i in range(len(csv_group)) if i not in used_csv]
    deletes = [db_group[j] for j in range(len(db_group)) if j not in used_db]

    return inserts, updates, deletes
```

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

Entries diff (affected pages: [12, 45, 67], threshold: 0.8):
  Matched: 85, Inserted: 2, Deleted: 1, Unmatched: 1 (score < 0.7)

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

- **首次同步（DB 为空）**：所有 pages 和 entries 都是 "added"，等价于全量导入，跳过模糊匹配
- **CSV 有新 section**：自动 INSERT section，与现有逻辑一致
- **page_num 为 NULL 的 entries**：不在 pages 变化过滤范围内，`--entries-only` 全量 diff 时仍会处理
- **markdown 无 page markers**：跳过 pages 同步，只做 entries
- **wrangler batch size**：D1 单次执行 ~100KB，SQL 分批提交（每批 100 条）
- **并发安全**：脚本不做并发控制，同一 source 同时只能跑一个同步
- **新增页的 entries**：DB 中无该页记录，跳过模糊匹配，直接全 INSERT
- **删除页的 entries**：新 markdown 中无该页，跳过模糊匹配，直接全 DELETE
- **匹配冲突**：两条 CSV 行都匹配到同一条 DB 行时，贪婪算法取最高分，落选的 CSV 行归为 INSERT
- **无共同字段**：CSV 行和 DB 行没有重叠的非空字段时，相似度为 0，归为 INSERT + DELETE

## 不做的事

- 不做 CI 自动触发（未来管理平台再做）
- 不自动删除空 section
- 不做 processor 集成（OCR → CSV 生成仍在 hokkien-writing 端完成）

## 未来扩展

- **管理平台 API**：后端 Hono 路由调用 `subprocess.run(["python3", "scripts/sync-source.py", ...])`
- **同步日志**：记录每次同步的统计（added/modified/deleted 数量）到 DB 或日志文件
- **多 source 并行**：不同 source_id 可并行同步，互不影响
- **dry-run 模式**：`--dry-run` 只输出 diff 不执行 SQL
