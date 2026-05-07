ALTER TABLE "Reactivation_Requests"
  ADD COLUMN IF NOT EXISTS id_document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_back_url TEXT;

UPDATE "Reactivation_Requests"
SET id_document_front_url = COALESCE(id_document_front_url, id_document_url)
WHERE id_document_url IS NOT NULL;
