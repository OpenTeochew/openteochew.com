ALTER TABLE entries ADD COLUMN latn_norm TEXT;
CREATE INDEX IF NOT EXISTS idx_entries_latn_norm ON entries(latn_norm);
