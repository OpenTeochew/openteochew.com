CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_zh TEXT,
  author TEXT,
  year TEXT,
  type TEXT NOT NULL DEFAULT 'text_dict',
  level TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  cover_url TEXT,
  total_entries INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
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
  sort_order INTEGER DEFAULT 0
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
CREATE INDEX IF NOT EXISTS idx_examples_entry ON examples(entry_id);
