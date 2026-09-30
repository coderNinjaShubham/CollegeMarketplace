/*
# Fix security advisor warnings

## Overview
Fixes two categories of security warnings found by Supabase's database linter:
1. Functions with mutable search_path — `set_updated_at` and `set_order_completed_at`
   need `SET search_path = public` added.
2. SECURITY DEFINER functions callable by `anon`/`authenticated` via the REST API —
   PostgreSQL grants EXECUTE to PUBLIC by default. `REVOKE FROM anon` is not sufficient;
   must `REVOKE FROM PUBLIC` and then re-grant only to the intended roles.

## Changes
- `set_updated_at()` and `set_order_completed_at()` — added `SET search_path = public`
- `handle_new_user()` — REVOKE EXECUTE FROM PUBLIC (trigger-only, not RPC-callable)
- `set_order_seller()` — REVOKE EXECUTE FROM PUBLIC (trigger-only, not RPC-callable)
- `is_admin()` — REVOKE FROM PUBLIC, GRANT to authenticated (needed by RLS policies)
- `set_user_role()` — REVOKE FROM PUBLIC, GRANT to authenticated (admin-only)
- `set_user_suspended()` — REVOKE FROM PUBLIC, GRANT to authenticated (admin-only)
- `update_report_status()` — REVOKE FROM PUBLIC, GRANT to authenticated (admin-only)

## Security Impact
After this migration, unauthenticated callers cannot invoke any SECURITY DEFINER
function via the REST API. Trigger functions are only callable by the database
trigger system, not via RPC.
*/

-- ─── Fix mutable search_path on trigger functions ──────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions ───────────

-- Trigger functions: not callable via RPC, only by trigger system
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_seller() FROM PUBLIC;

-- Helper/admin functions: callable only by authenticated users
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, user_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_report_status(uuid, report_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_report_status(uuid, report_status, text) TO authenticated;
