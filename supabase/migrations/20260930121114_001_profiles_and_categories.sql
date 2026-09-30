/*
# Create profiles, categories tables and enum types

## Overview
Sets up the foundational schema for NITW Market: user profiles (linked to Supabase Auth),
product categories with seed data, and shared enum types used across all tables.

## New Tables

### profiles
Stores student profile information. Each row corresponds to one auth user.
- `id` (uuid, PK) — matches auth.users.id
- `name` (text, not null) — full name
- `email` (text, unique, not null) — NITW email
- `roll_number` (text, nullable) — student roll number
- `branch` (text, nullable) — engineering branch
- `year` (text, nullable) — academic year
- `hostel_block` (text, nullable) — hostel or "Day Scholar"
- `avatar_url` (text, nullable) — profile picture URL
- `role` (user_role enum, default 'user') — 'user' or 'admin'; protected column
- `is_suspended` (boolean, default false) — moderation flag; protected column
- `created_at`, `updated_at` (timestamptz)

### categories
Product categories (Books, Electronics, etc.). Seeded with 9 initial categories.
- `id` (int, PK, serial)
- `name` (text, unique, not null)
- `slug` (text, unique, not null) — URL-safe identifier
- `icon` (text, not null) — lucide-react icon name
- `sort_order` (int, default 0)
- `created_at` (timestamptz)

## New Enum Types
- `user_role` — 'user', 'admin'
- `product_status` — 'active', 'reserved', 'sold', 'removed'
- `product_condition` — 'brand_new', 'like_new', 'good', 'fair', 'needs_repair'
- `order_status` — 'pending', 'accepted', 'rejected', 'completed', 'cancelled'
- `report_status` — 'pending', 'reviewing', 'resolved', 'dismissed'
- `notification_type` — 'order', 'review', 'report', 'system'

## Security
- RLS enabled on profiles. Users can read/update their own profile. Admins can read all.
- The `role` and `is_suspended` columns are protected: UPDATE revoked from authenticated,
  changes only possible through SECURITY DEFINER functions that verify the caller is an admin.
- RLS enabled on categories. Public read (anon + authenticated), no client writes.
- A trigger auto-creates a profile row when a new auth user signs up.

## Important Notes
1. The `handle_new_user` trigger fires on auth.users INSERT to create a profile row
   automatically from sign-up metadata (name, roll_number, branch, year, hostel_block).
2. Column-level privileges on profiles ensure clients cannot self-grant admin or
   unsuspend themselves.
3. The `is_admin()` helper function checks if the current user has role = 'admin'.
*/

-- ─── Enum types ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'reserved', 'sold', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_condition AS ENUM ('brand_new', 'like_new', 'good', 'fair', 'needs_repair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('order', 'review', 'report', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Profiles table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text UNIQUE NOT NULL,
  roll_number  text,
  branch       text,
  year         text,
  hostel_block text,
  avatar_url   text,
  role         user_role NOT NULL DEFAULT 'user',
  is_suspended boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Categories table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         serial PRIMARY KEY,
  name       text UNIQUE NOT NULL,
  slug       text UNIQUE NOT NULL,
  icon       text NOT NULL DEFAULT 'Package',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Admin helper function ─────────────────────────────────────────────────
-- Must be created before policies that reference it.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── Admin-only function to set user role ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_role(p_target_user uuid, p_role user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE profiles SET role = p_role, updated_at = now() WHERE id = p_target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, user_role) TO authenticated;

-- ─── Admin-only function to suspend/unsuspend ──────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_suspended(p_target_user uuid, p_suspended boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_suspended = p_suspended, updated_at = now() WHERE id = p_target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean) TO authenticated;

-- ─── Auto-create profile on signup ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, roll_number, branch, year, hostel_block)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    NEW.raw_user_meta_data->>'roll_number',
    NEW.raw_user_meta_data->>'branch',
    NEW.raw_user_meta_data->>'year',
    NEW.raw_user_meta_data->>'hostel_block'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Enable RLS on profiles ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins can read all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Users can update their own profile (column privileges restrict which columns)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Inserts: allow user to insert their own profile row (for direct upsert from signup)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Column-level protection: clients cannot change role or is_suspended
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (name, roll_number, branch, year, hostel_block, avatar_url) ON profiles TO authenticated;

-- ─── Enable RLS on categories ──────────────────────────────────────────────

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see categories
DROP POLICY IF EXISTS "categories_select_public" ON categories;
CREATE POLICY "categories_select_public"
  ON categories FOR SELECT TO anon, authenticated
  USING (true);

-- ─── Seed categories ────────────────────────────────────────────────────────

INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Books', 'books', 'BookOpen', 1),
  ('Electronics', 'electronics', 'Laptop', 2),
  ('Engineering Instruments', 'engineering-instruments', 'Ruler', 3),
  ('Hostel Items', 'hostel-items', 'Bed', 4),
  ('Cycles', 'cycles', 'Bike', 5),
  ('Furniture', 'furniture', 'Armchair', 6),
  ('Clothing', 'clothing', 'Shirt', 7),
  ('Stationery', 'stationery', 'PenTool', 8),
  ('Other', 'other', 'Package', 9)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
