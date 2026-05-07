-- ─────────────────────────────────────────────────────────────────────────
-- Reactivation_Requests table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Reactivation_Requests" (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID        REFERENCES "User"(user_id) ON DELETE SET NULL,
    email             TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected')),
    id_document_url   TEXT        NOT NULL,
    id_document_front_url TEXT,
    id_document_back_url  TEXT,
    user_message      TEXT,
    admin_notes       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reactivation_email  ON "Reactivation_Requests"(email);
CREATE INDEX IF NOT EXISTS idx_reactivation_status ON "Reactivation_Requests"(status);
CREATE INDEX IF NOT EXISTS idx_reactivation_user   ON "Reactivation_Requests"(user_id);

-- Enable real-time so admin portal can receive live updates
ALTER PUBLICATION supabase_realtime ADD TABLE "Reactivation_Requests";

-- ─────────────────────────────────────────────────────────────────────────
-- Storage bucket for ID documents
-- Create this manually in Supabase Dashboard → Storage:
--   Bucket name : reactivation-id-documents
--   Public      : true  (so admin can preview via URL)
--   File size   : 10 MB
--   Allowed MIME: image/jpeg, image/png, image/jpg, application/pdf
-- ─────────────────────────────────────────────────────────────────────────
