CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_zh TEXT,
  author TEXT,
  year TEXT,
  type TEXT NOT NULL DEFAULT 'dictionary',
  level TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  cover_url TEXT,
  total_entries INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  original_fields TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  section_id INTEGER REFERENCES sections(id),
  han TEXT,
  puj TEXT,
  dp TEXT,
  en TEXT,
  mandarin TEXT,
  ja TEXT,
  puj_orig TEXT,
  han_orig TEXT,
  en_orig TEXT,
  page_num INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  teochew TEXT NOT NULL,
  puj TEXT,
  translation TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  page_num INTEGER NOT NULL,
  image_url TEXT,
  ocr_text TEXT,
  sort_order INTEGER DEFAULT 0,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_source ON entries(source_id);
CREATE INDEX IF NOT EXISTS idx_entries_section ON entries(section_id);
CREATE INDEX IF NOT EXISTS idx_entries_han ON entries(han);
CREATE INDEX IF NOT EXISTS idx_entries_puj ON entries(puj);
CREATE INDEX IF NOT EXISTS idx_entries_dp ON entries(dp);
CREATE INDEX IF NOT EXISTS idx_entries_en ON entries(en);
CREATE INDEX IF NOT EXISTS idx_entries_mandarin ON entries(mandarin);
CREATE INDEX IF NOT EXISTS idx_entries_ja ON entries(ja);
CREATE INDEX IF NOT EXISTS idx_entries_page ON entries(source_id, page_num);
CREATE INDEX IF NOT EXISTS idx_sections_source ON sections(source_id);
CREATE INDEX IF NOT EXISTS idx_pages_source ON pages(source_id, page_num);
CREATE INDEX IF NOT EXISTS idx_pages_hash ON pages(source_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_examples_entry ON examples(entry_id);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
