ALTER TABLE sources ADD COLUMN content_stage TEXT DEFAULT 'missing';

UPDATE sources SET content_stage = CASE
  WHEN total_entries > 0 THEN 'curated'
  WHEN (SELECT COUNT(*) FROM pages p WHERE p.source_id = sources.id AND p.ocr_text IS NOT NULL AND TRIM(p.ocr_text) != '') > 0 THEN 'pending_curation'
  WHEN total_pages > 0 THEN 'pending_ocr'
  ELSE 'missing'
END;
