-- Migration 008: suggestions table for visitor-submitted OCR revisions and feedback.
-- See docs/superpowers/specs/2026-07-04-suggestions-design.md

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  source_id INTEGER,
  page_num INTEGER,
  url TEXT,
  selected_text TEXT,
  user_note TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_source ON suggestions(source_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at DESC);
