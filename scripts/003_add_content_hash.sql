ALTER TABLE pages ADD COLUMN content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_pages_hash ON pages(source_id, content_hash);
