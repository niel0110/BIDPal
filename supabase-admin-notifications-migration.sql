-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Creates the Admin_Notifications table used by the admin portal alert system

CREATE TABLE IF NOT EXISTS "Admin_Notifications" (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT        NOT NULL DEFAULT 'new_user',
  title       TEXT        NOT NULL,
  message     TEXT,
  metadata    JSONB       DEFAULT '{}',
  is_read     BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read
  ON "Admin_Notifications" (is_read);

-- Index for chronological listing
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at
  ON "Admin_Notifications" (created_at DESC);

-- Enable real-time on this table (required for live bell badge updates)
ALTER PUBLICATION supabase_realtime ADD TABLE "Admin_Notifications";
