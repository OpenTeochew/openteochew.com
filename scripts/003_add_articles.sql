CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);

INSERT INTO articles (source_id, title, content) VALUES
(1, '測試文章：潮州話食字用法', '# 食字用法

潮州話中的「食」字用法比普通話更廣泛，涵蓋吃喝。

## 常見用法

| 詞語 | PUJ | 釋義 |
|------|-----|------|
| 食飯 | tsia̍h-pn̄g | 吃飯 |
| 食茶 | tsia̍h-tê | 喝茶 |
| 食酒 | tsia̍h-tsiú | 喝酒 |

> 資料整理自 Ashmore (1883) 及 Campbell (1904)。');
