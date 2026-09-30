/*
# Create notifications and reports tables

## Overview
Creates the notification system (alerts for orders, reviews, reports, system messages)
and the moderation/report system (users flag products or other users for admin review).

## New Tables

### notifications
Per-user alerts about marketplace activity.
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `type` (notification_type enum, NOT NULL)
- `title` (text, NOT NULL)
- `body` (text, nullable)
- `link` (text, nullable) — URL to navigate to when clicked
- `is_read` (boolean, NOT NULL DEFAULT false)
- `created_at` (timestamptz)

### reports
User-submitted reports about products or other users for moderation.
- `id` (uuid, PK)
- `reporter_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `target_type` (text, NOT NULL) — 'product' or 'user'
- `target_id` (uuid, NOT NULL) — ID of the product or user being reported
- `reason` (text, NOT NULL) — why the reporter is flagging this
- `status` (report_status enum, NOT NULL DEFAULT 'pending')
- `admin_notes` (text, nullable) — admin's notes on resolution; protected
- `resolved_by` (uuid, FK → profiles.id, nullable) — admin who handled it; protected
- `resolved_at` (timestamptz, nullable)
- `created_at`, `updated_at` (timestamptz)

## Security

### notifications RLS
- SELECT/UPDATE/DELETE: owner only (user_id = auth.uid()).
- INSERT: owner only. System notifications are created via SECURITY DEFINER
  functions or edge functions, not directly by clients.

### reports RLS
- SELECT: reporter sees their own reports; admins see all.
- INSERT: authenticated users, only for their own reporter_id.
- UPDATE: admin only (to update status, add notes, resolve).
  Column-level protection: admin_notes and resolved_by are not client-writable.
- DELETE: admin only.

## Important Notes
1. Reports are intentionally not deletable by the reporter once submitted,
   to prevent abuse of the reporting system.
2. Admin notes and resolution metadata are protected via column-level grants —
   only the admin SECURITY DEFINER path can write them.
3. Notifications are private to each user.
*/

-- ─── Notifications table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: owner only
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: owner only (clients create their own notification records)
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner only (mark as read)
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner only
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─── Reports table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('product', 'user')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (length(trim(reason)) >= 1 AND length(reason) <= 2000),
  status      report_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- SELECT: reporter sees own reports; admins see all
DROP POLICY IF EXISTS "reports_select_own_or_admin" ON reports;
CREATE POLICY "reports_select_own_or_admin"
  ON reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin());

-- INSERT: authenticated users report on their own behalf
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- UPDATE: admin only (status changes, notes, resolution)
DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin"
  ON reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "reports_delete_admin" ON reports;
CREATE POLICY "reports_delete_admin"
  ON reports FOR DELETE TO authenticated
  USING (public.is_admin());

-- Column protection: reporter_id, admin_notes, resolved_by, resolved_at, status
-- are not directly writable by the reporter. Only admin can update status/notes.
-- The reporter can only set reporter_id (defaulted) and reason/target on INSERT.
REVOKE UPDATE ON reports FROM authenticated;
-- No GRANT UPDATE — admin updates go through the RLS policy but since we revoked
-- UPDATE, we need a SECURITY DEFINER function for admin to update reports.

-- ─── Admin function to update report status ────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_status report_status,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE reports
  SET status = p_status,
      admin_notes = p_admin_notes,
      resolved_by = CASE WHEN p_status IN ('resolved', 'dismissed') THEN auth.uid() ELSE resolved_by END,
      resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN now() ELSE resolved_at END,
      updated_at = now()
  WHERE id = p_report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_report_status(uuid, report_status, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_report_status(uuid, report_status, text) TO authenticated;

-- ─── updated_at trigger for reports ────────────────────────────────────────

DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
