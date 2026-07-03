-- Migration 007: enforce uniqueness on (source_id, page_num) in pages table
-- Prevents duplicate page inserts on repeated sync runs. Existing duplicates
-- were removed prior to applying this migration (keeping the row with min id
-- per (source_id, page_num)).

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_source_page_unique
  ON pages(source_id, page_num);
