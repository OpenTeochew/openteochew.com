CREATE TABLE IF NOT EXISTS zh_en_dict (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zh_tw TEXT NOT NULL,
  en TEXT NOT NULL,
  pos TEXT
);

CREATE INDEX IF NOT EXISTS idx_zh_en_dict_zh_tw ON zh_en_dict(zh_tw);
CREATE INDEX IF NOT EXISTS idx_zh_en_dict_en ON zh_en_dict(en);
