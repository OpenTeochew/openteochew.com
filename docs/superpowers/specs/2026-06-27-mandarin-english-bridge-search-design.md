# 普通話中英橋接搜索

## 問題

現有搜索已支持 `q_mandarin` 直接匹配 `entries.mandarin`，並且會把簡體輸入轉為繁體後查詢。但部分詞條沒有普通話欄位，或普通話欄位覆蓋不完整。用戶用普通話查詢時，可能明明有對應潮州話詞條，卻因 `entries.mandarin` 缺失而搜不到。

`tmp/zh-TW_en_dict.csv` 提供一份中英詞典，可用作橋接：普通話詞 → 英文候選 → `entries.en/en_orig` → 潮州話詞條。

## 目標

- 保留現有 `entries.mandarin` 直接搜索作為第一優先
- direct 搜索零結果時，才啟用中英詞典橋接
- 支持簡體普通話輸入，因資料庫與詞典使用繁體中文
- 控制橋接噪音與查詢成本，英文候選最多 5 個
- 前端可選擇提示「經中英詞典匹配」

## 不在範圍內

- 不改搜尋 UI 形態
- 不做多語義消歧模型
- 不引入全文搜索引擎
- 不把所有中英候選完整展開為無限制查詢

## 資料模型

新增表：

```sql
CREATE TABLE IF NOT EXISTS zh_en_dict (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zh_tw TEXT NOT NULL,
  en TEXT NOT NULL,
  pos TEXT
);

CREATE INDEX IF NOT EXISTS idx_zh_en_dict_zh_tw ON zh_en_dict(zh_tw);
CREATE INDEX IF NOT EXISTS idx_zh_en_dict_en ON zh_en_dict(en);
```

只保留 CSV 中三欄：

| CSV 欄位 | DB 欄位 |
|----------|---------|
| `zh-TW` | `zh_tw` |
| `en` | `en` |
| `pos` | `pos` |

`us_pr`、`uk_pr`、`label` 不匯入。

## 匯入流程

新增或擴展同步腳本，把 `tmp/zh-TW_en_dict.csv` 匯入 D1。

要求：

1. 清空或重建 `zh_en_dict`
2. 讀取 CSV header
3. 對每行只取 `zh-TW`、`en`、`pos`
4. 跳過 `zh-TW` 或 `en` 為空的行
5. 寫入 local 與 remote D1 的流程應保持一致

## 查詢流程

當 API 收到 `q_mandarin`：

```text
input = q_mandarin
traditional = OpenCC 簡→繁(input)

1. direct search
   用 input + traditional 查 entries.mandarin

2. 如果 direct total > 0
   直接返回 direct 結果

3. 如果 direct total == 0
   查 zh_en_dict.zh_tw，取得最多 5 個英文候選

4. 用英文候選查 entries.en / entries.en_orig
   返回橋接結果
```

### 簡繁處理

`q_mandarin` 必須保留既有簡繁體支持：

- direct 查 `entries.mandarin` 時，同時使用原輸入與繁體轉換值
- fallback 查 `zh_en_dict.zh_tw` 時，也同時使用原輸入與繁體轉換值
- 如果原輸入已是繁體，OpenCC 轉換結果通常相同，避免重複條件即可

例：

```text
用戶輸入：电脑
轉繁：電腦

查 entries.mandarin:
  mandarin LIKE '%电脑%' OR mandarin LIKE '%電腦%'

若無結果，查 zh_en_dict:
  zh_tw LIKE '%电脑%' OR zh_tw LIKE '%電腦%'
```

## 中英詞典候選排序

橋接候選使用模糊優先，但限制最多 5 個英文詞。

排序：

1. `zh_tw = query` 精確匹配
2. `zh_tw LIKE query || '%'` 前綴匹配
3. `zh_tw LIKE '%' || query || '%'` 包含匹配
4. `LENGTH(zh_tw)` 短詞優先
5. `id` 穩定排序

如果原輸入與繁體轉換不同，兩者都參與排序；任一精確命中都算精確。

返回候選時去重英文詞，避免同一英文因多個中文釋義重複查詢。

## entries 英文查詢

橋接查詢只在 `q_mandarin` direct 無結果時啟用。

SQL 條件：

```sql
(e.en LIKE ? OR e.en_orig LIKE ?)
```

對最多 5 個英文候選建立 OR 條件。排序應優先保留候選順序：第一個英文候選命中的詞條排在第二個之前，再套用既有 source、sort_order 或 relevance 排序。

## API 回傳

可在 search result 增加選用欄位：

```ts
match_meta?: {
  mode: 'direct' | 'mandarin_bridge'
  bridge_terms?: string[]
}
```

含義：

- `direct`：由 `entries.mandarin` 直接命中
- `mandarin_bridge`：由 `zh_en_dict` 找英文候選後命中 `entries.en/en_orig`
- `bridge_terms`：實際使用的英文候選，最多 5 個

前端若不使用此欄位，現有結果展示不受影響。

## 錯誤與邊界情況

| 情況 | 處理 |
|------|------|
| `q_mandarin` 空 | 不啟用橋接 |
| direct 有結果 | 不啟用橋接，避免噪音 |
| 中英詞典無候選 | 返回空結果 |
| 英文候選有重複 | 去重後最多 5 個 |
| 簡體輸入 | 原輸入與繁體轉換都查 |
| 詞典 CSV 欄位缺失 | 匯入腳本應報錯停止 |

## 性能考量

- `entries.mandarin` direct 搜索保持現有行為
- `zh_en_dict` 增加 `zh_tw` 索引，但 `%query%` 包含匹配不能完全利用普通索引；候選限制為 5 個以控制後續成本
- `entries.en/en_orig` 最多 5 組英文 LIKE 條件，避免無限制 OR
- 如果未來詞典查詢成為瓶頸，再考慮 FTS 或預計算 normalized token 表

## 成功標準

1. 輸入繁體普通話詞時，先查 `entries.mandarin`
2. 輸入簡體普通話詞時，會轉繁並匹配繁體資料
3. direct 無結果時，能通過 `zh_en_dict` 找到最多 5 個英文候選
4. 橋接候選能查到 `entries.en/en_orig` 中的潮州話詞條
5. direct 有結果時，不混入橋接結果
6. 現有漢字、PUJ、DP、英文、日文搜索不受影響
