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
/*
# Create products and product_images tables

## Overview
Creates the product listing table and a child table for multiple images per product.
Products are the core entity of the marketplace — each listing is owned by a seller
who can create, update, and delete their own listings.

## New Tables

### products
Marketplace listings created by students.
- `id` (uuid, PK)
- `seller_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `category_id` (int, FK → categories.id, NOT NULL)
- `title` (text, NOT NULL, 1–200 chars)
- `description` (text, NOT NULL, 1–5000 chars)
- `price` (numeric(10,2), NOT NULL, CHECK >= 0)
- `condition` (product_condition enum, NOT NULL)
- `status` (product_status enum, NOT NULL DEFAULT 'active')
- `image_url` (text, nullable) — primary/cover image URL
- `view_count` (int, NOT NULL DEFAULT 0)
- `created_at`, `updated_at` (timestamptz)

### product_images
Additional images for a product (gallery beyond the cover image).
- `id` (uuid, PK)
- `product_id` (uuid, FK → products.id ON DELETE CASCADE)
- `image_url` (text, NOT NULL)
- `sort_order` (int, DEFAULT 0)
- `created_at` (timestamptz)

## Security
- RLS on products:
  - SELECT: public (anon + authenticated) can see active/reserved/sold listings;
    sellers can see all their own listings including 'removed'; admins can see all.
  - INSERT: authenticated users, only for their own seller_id.
  - UPDATE: only the seller or an admin.
  - DELETE: only the seller or an admin.
- RLS on product_images:
  - SELECT: public — anyone can view images of visible products.
  - INSERT/UPDATE/DELETE: only the product's seller or admin.
- Column protection: `view_count`, `status` can be updated by seller but
  `seller_id` is defaulted and not client-settable via INSERT grant.

## Indexes
- products(seller_id) — dashboard "my listings" query
- products(category_id) — category browse pages
- products(status) — filter active listings
- products(created_at DESC) — recently listed
- products(price) — price filtering/sorting
- product_images(product_id) — gallery lookup
*/

-- ─── Products table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category_id int  NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title       text NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 200),
  description text NOT NULL CHECK (length(trim(description)) >= 1 AND length(description) <= 5000),
  price       numeric(10,2) NOT NULL CHECK (price >= 0),
  condition   product_condition NOT NULL,
  status      product_status NOT NULL DEFAULT 'active',
  image_url   text,
  view_count  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can browse visible listings; sellers see their own removed items; admins see all
DROP POLICY IF EXISTS "products_select_visible" ON products;
CREATE POLICY "products_select_visible"
  ON products FOR SELECT TO anon, authenticated
  USING (
    status IN ('active', 'reserved', 'sold')
    OR auth.uid() = seller_id
    OR public.is_admin()
  );

-- INSERT: seller creates their own listing
DROP POLICY IF EXISTS "products_insert_own" ON products;
CREATE POLICY "products_insert_own"
  ON products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- UPDATE: only the seller or admin
DROP POLICY IF EXISTS "products_update_own_or_admin" ON products;
CREATE POLICY "products_update_own_or_admin"
  ON products FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id OR public.is_admin())
  WITH CHECK (auth.uid() = seller_id OR public.is_admin());

-- DELETE: only the seller or admin
DROP POLICY IF EXISTS "products_delete_own_or_admin" ON products;
CREATE POLICY "products_delete_own_or_admin"
  ON products FOR DELETE TO authenticated
  USING (auth.uid() = seller_id OR public.is_admin());

-- ─── Product images table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url  text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can view images of visible products
DROP POLICY IF EXISTS "product_images_select_visible" ON product_images;
CREATE POLICY "product_images_select_visible"
  ON product_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (p.status IN ('active', 'reserved', 'sold') OR auth.uid() = p.seller_id OR public.is_admin())
    )
  );

-- INSERT: only the product's seller or admin
DROP POLICY IF EXISTS "product_images_insert_own" ON product_images;
CREATE POLICY "product_images_insert_own"
  ON product_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (auth.uid() = p.seller_id OR public.is_admin())
    )
  );

-- UPDATE: only the product's seller or admin
DROP POLICY IF EXISTS "product_images_update_own" ON product_images;
CREATE POLICY "product_images_update_own"
  ON product_images FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (auth.uid() = p.seller_id OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (auth.uid() = p.seller_id OR public.is_admin())
    )
  );

-- DELETE: only the product's seller or admin
DROP POLICY IF EXISTS "product_images_delete_own" ON product_images;
CREATE POLICY "product_images_delete_own"
  ON product_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (auth.uid() = p.seller_id OR public.is_admin())
    )
  );

-- ─── Triggers ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
/*
# Create orders, favorites, and reviews tables

## Overview
Creates the transaction system (orders/reservations), the bookmark system (favorites),
and the reputation system (reviews). Reviews are gated to only be created after a
completed order, enforced server-side.

## New Tables

### orders
Represents a buyer's interest in a product — a reservation or purchase request.
- `id` (uuid, PK)
- `product_id` (uuid, FK → products.id ON DELETE CASCADE)
- `buyer_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `seller_id` (uuid, FK → profiles.id, NOT NULL) — denormalized for fast dashboard queries
- `status` (order_status enum, NOT NULL DEFAULT 'pending')
- `quantity` (int, NOT NULL DEFAULT 1, CHECK 1–100)
- `message` (text, nullable) — buyer's note to seller
- `meeting_location` (text, nullable) — suggested pickup spot
- `completed_at` (timestamptz, nullable) — set when status = 'completed'
- `created_at`, `updated_at` (timestamptz)

### favorites
Bookmark/saved items per user. Each user can favorite a product once.
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `product_id` (uuid, FK → products.id ON DELETE CASCADE)
- `created_at` (timestamptz)
- UNIQUE(user_id, product_id)

### reviews
Buyer reviews for sellers, only allowed after a completed order.
- `id` (uuid, PK)
- `order_id` (uuid, FK → orders.id, NOT NULL)
- `reviewer_id` (uuid, FK → profiles.id, NOT NULL DEFAULT auth.uid())
- `reviewee_id` (uuid, FK → profiles.id, NOT NULL) — the seller being reviewed
- `product_id` (uuid, FK → products.id, NOT NULL)
- `rating` (int, NOT NULL, CHECK 1–5)
- `comment` (text, nullable, max 2000 chars)
- `created_at` (timestamptz)
- UNIQUE(order_id) — one review per order

## Security

### orders RLS
- SELECT: only buyer, seller, or admin.
- INSERT: buyer creates their own order (buyer_id = auth.uid()).
- UPDATE: buyer or seller or admin (to accept/reject/complete).
- DELETE: buyer or seller or admin.

### favorites RLS
- SELECT: only the owner.
- INSERT: owner only (user_id = auth.uid()).
- DELETE: owner only.

### reviews RLS
- SELECT: public — anyone can see reviews (reputation is visible).
- INSERT: only the buyer of a COMPLETED order, for that specific order.
  Enforced via WITH CHECK that the order exists, status='completed', and
  the reviewer is the buyer.
- UPDATE/DELETE: only the reviewer or admin.

## Important Notes
1. Reviews are gated server-side: the WITH CHECK predicate verifies the order
   is completed and the reviewer is the buyer — a client cannot fake this.
2. Order seller_id is denormalized from products at insert time via a trigger
   so dashboard queries don't need a join.
3. A unique constraint on (user_id, product_id) in favorites prevents
   duplicate bookmarks.
*/

-- ─── Orders table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           order_status NOT NULL DEFAULT 'pending',
  quantity         int NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 100),
  message          text,
  meeting_location text,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- SELECT: buyer, seller, or admin
DROP POLICY IF EXISTS "orders_select_participants" ON orders;
CREATE POLICY "orders_select_participants"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin());

-- INSERT: buyer creates their own order
DROP POLICY IF EXISTS "orders_insert_buyer" ON orders;
CREATE POLICY "orders_insert_buyer"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- UPDATE: buyer, seller, or admin
DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants"
  ON orders FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin())
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin());

-- DELETE: buyer, seller, or admin
DROP POLICY IF EXISTS "orders_delete_participants" ON orders;
CREATE POLICY "orders_delete_participants"
  ON orders FOR DELETE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_admin());

-- ─── Trigger: auto-set seller_id from product on insert ────────────────────

CREATE OR REPLACE FUNCTION public.set_order_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT seller_id INTO v_seller_id FROM products WHERE id = NEW.product_id;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  NEW.seller_id := v_seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_seller ON orders;
CREATE TRIGGER orders_set_seller
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_seller();

-- ─── Trigger: set completed_at when status becomes 'completed' ─────────────

CREATE OR REPLACE FUNCTION public.set_order_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_completed_at ON orders;
CREATE TRIGGER orders_set_completed_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_completed_at();

-- ─── updated_at trigger for orders ─────────────────────────────────────────

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Favorites table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- SELECT: owner only
DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own"
  ON favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: owner only
DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
CREATE POLICY "favorites_insert_own"
  ON favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner only
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_delete_own"
  ON favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─── Reviews table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating      int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text CHECK (comment IS NULL OR length(comment) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: public — anyone can see reviews (reputation is visible to all)
DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
CREATE POLICY "reviews_select_public"
  ON reviews FOR SELECT TO anon, authenticated
  USING (true);

-- INSERT: only the buyer of a completed order, for that order
DROP POLICY IF EXISTS "reviews_insert_completed_order" ON reviews;
CREATE POLICY "reviews_insert_completed_order"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = reviews.order_id
        AND o.buyer_id = auth.uid()
        AND o.status = 'completed'
    )
  );

-- UPDATE: only the reviewer or admin
DROP POLICY IF EXISTS "reviews_update_own_or_admin" ON reviews;
CREATE POLICY "reviews_update_own_or_admin"
  ON reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id OR public.is_admin())
  WITH CHECK (auth.uid() = reviewer_id OR public.is_admin());

-- DELETE: only the reviewer or admin
DROP POLICY IF EXISTS "reviews_delete_own_or_admin" ON reviews;
CREATE POLICY "reviews_delete_own_or_admin"
  ON reviews FOR DELETE TO authenticated
  USING (auth.uid() = reviewer_id OR public.is_admin());

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
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
/*
# Create storage bucket and policies for product images

## Overview
Creates a private storage bucket 'product-images' for product listing photos.
Storage policies enforce that:
- Any visitor can read product images (listings are publicly browsable).
- Only authenticated users can upload, and only into their own folder (auth.uid()).
- Users can update/delete only their own folder's images.
- File size is limited to 5MB and allowed MIME types are enforced.

## Storage Bucket
- Name: `product-images`
- Public: false (private — served via signed URLs or public path if needed)
- File size limit: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

## Storage Policies (on storage.objects)
1. SELECT — public read: anyone can view product images.
2. INSERT — authenticated users, only into their own folder: `product-images/<uid>/`.
3. UPDATE — only the owner of the folder.
4. DELETE — only the owner of the folder.

## Important Notes
1. The folder structure is `product-images/<user_id>/<filename>`. The policy
   enforces that the first path segment matches auth.uid(), so users cannot
   write into another user's namespace.
2. The bucket is private. To display images to visitors, either use signed URLs
   or make the bucket public later if desired. The read policy allows anon access
   through the storage API regardless of bucket public/private setting.
3. MIME type and file size limits are set at the bucket level.
*/

-- ─── Create the storage bucket ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Storage policies ──────────────────────────────────────────────────────

-- SELECT: anyone can view product images (public browsing)
DROP POLICY IF EXISTS "product_images_read_public" ON storage.objects;
CREATE POLICY "product_images_read_public"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- INSERT: authenticated users, only into their own folder
DROP POLICY IF EXISTS "product_images_insert_own_folder" ON storage.objects;
CREATE POLICY "product_images_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: only the owner of the folder
DROP POLICY IF EXISTS "product_images_update_own_folder" ON storage.objects;
CREATE POLICY "product_images_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: only the owner of the folder
DROP POLICY IF EXISTS "product_images_delete_own_folder" ON storage.objects;
CREATE POLICY "product_images_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
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
/*
# Revoke EXECUTE on trigger-only SECURITY DEFINER functions

The previous REVOKE FROM PUBLIC did not fully remove access to handle_new_user
and set_order_seller. Explicitly revoking from anon and authenticated ensures
these trigger-only functions are not callable via the REST API.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.set_order_seller() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_seller() FROM authenticated;
/*
# Add server-controlled seller information to products

## Overview
Adds non-sensitive seller display fields to products so public marketplace pages can
show seller information without exposing private profile columns such as email.

## Changes
- Add `seller_name`, `seller_branch`, and `seller_hostel_block` to products.
- Populate them from the authenticated seller's profile in a SECURITY DEFINER trigger.
- Refresh the snapshot when a product is created or edited.
- Restrict authenticated INSERT and UPDATE privileges so clients cannot write the
  seller identity fields directly.

## Security
The seller identity is always derived from the authenticated session and the linked
profile row. The existing product ownership RLS policies remain the authority for
which user may create or edit a listing.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_branch text,
  ADD COLUMN IF NOT EXISTS seller_hostel_block text;

CREATE OR REPLACE FUNCTION public.set_product_seller_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT name, branch, hostel_block
  INTO NEW.seller_name, NEW.seller_branch, NEW.seller_hostel_block
  FROM profiles
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_seller_snapshot ON products;
CREATE TRIGGER products_set_seller_snapshot
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_seller_snapshot();

UPDATE products p
SET seller_name = pr.name,
    seller_branch = pr.branch,
    seller_hostel_block = pr.hostel_block
FROM profiles pr
WHERE pr.id = p.seller_id;

REVOKE INSERT ON products FROM authenticated;
GRANT INSERT (category_id, title, description, price, condition, image_url) ON products TO authenticated;

REVOKE UPDATE ON products FROM authenticated;
GRANT UPDATE (category_id, title, description, price, condition, status, image_url) ON products TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_product_seller_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_product_seller_snapshot() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_product_seller_snapshot() FROM authenticated;

-- --- Fix anon access to is_admin() -----------------------------------------
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;



-- ─── Migration 010: Phase 5 — Order State Machine & Notification Triggers ───

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_reservation
  ON orders (buyer_id, product_id)
  WHERE status IN ('pending', 'accepted');

CREATE OR REPLACE FUNCTION public.process_order_transition(
  p_order_id uuid,
  p_new_status order_status
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order         orders%ROWTYPE;
  v_caller_id     uuid := auth.uid();
  v_product_title text;
  v_seller_name   text;
  v_buyer_name    text;
  v_notif_seller  json;
  v_notif_buyer   json;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_caller_id != v_order.buyer_id AND v_caller_id != v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized: you are not a participant in this order';
  END IF;

  CASE v_order.status
    WHEN 'pending' THEN
      IF p_new_status = 'accepted' OR p_new_status = 'rejected' THEN
        IF v_caller_id != v_order.seller_id THEN
          RAISE EXCEPTION 'Only the seller can accept or reject a pending reservation';
        END IF;
      ELSIF p_new_status = 'cancelled' THEN
        IF v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only the buyer can cancel their own reservation';
        END IF;
      ELSE
        RAISE EXCEPTION 'Invalid transition from pending to %', p_new_status;
      END IF;

    WHEN 'accepted' THEN
      IF p_new_status = 'completed' THEN
        IF v_caller_id != v_order.seller_id AND v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only buyer or seller can mark an order as completed';
        END IF;
      ELSIF p_new_status = 'cancelled' THEN
        IF v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only the buyer can cancel an accepted reservation';
        END IF;
      ELSE
        RAISE EXCEPTION 'Invalid transition from accepted to %', p_new_status;
      END IF;

    ELSE
      RAISE EXCEPTION 'Order in status % cannot be transitioned further', v_order.status;
  END CASE;

  UPDATE orders
    SET status = p_new_status,
        updated_at = now(),
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_order_id;

  SELECT title INTO v_product_title FROM products WHERE id = v_order.product_id;

  IF p_new_status = 'accepted' THEN
    UPDATE products SET status = 'reserved', updated_at = now()
    WHERE id = v_order.product_id AND status = 'active';

  ELSIF p_new_status IN ('rejected', 'cancelled') THEN
    UPDATE products SET status = 'active', updated_at = now()
    WHERE id = v_order.product_id AND status = 'reserved';

  ELSIF p_new_status = 'completed' THEN
    UPDATE products SET status = 'sold', updated_at = now()
    WHERE id = v_order.product_id;
  END IF;

  SELECT name INTO v_seller_name FROM profiles WHERE id = v_order.seller_id;
  SELECT name INTO v_buyer_name  FROM profiles WHERE id = v_order.buyer_id;

  CASE p_new_status
    WHEN 'accepted' THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.buyer_id,
        'order',
        'Reservation Accepted!',
        v_seller_name || ' accepted your reservation for "' || v_product_title || '". Arrange pickup!',
        '/dashboard/orders'
      );

    WHEN 'rejected' THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.buyer_id,
        'order',
        'Reservation Declined',
        v_seller_name || ' declined your reservation for "' || v_product_title || '".',
        '/dashboard/orders'
      );

    WHEN 'cancelled' THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.seller_id,
        'order',
        'Reservation Cancelled',
        v_buyer_name || ' cancelled their reservation for "' || v_product_title || '".',
        '/dashboard/orders'
      );

    WHEN 'completed' THEN
      IF v_caller_id = v_order.seller_id THEN
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
          v_order.buyer_id,
          'order',
          'Order Completed',
          '"' || v_product_title || '" has been marked as completed by the seller.',
          '/dashboard/orders'
        );
      ELSE
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
          v_order.seller_id,
          'order',
          'Order Completed',
          v_buyer_name || ' confirmed completion of "' || v_product_title || '".',
          '/dashboard/orders'
        );
      END IF;

    ELSE NULL;
  END CASE;

  RETURN json_build_object('success', true, 'new_status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_order_transition(uuid, order_status) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_order_transition(uuid, order_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_reservation(
  p_product_id     uuid,
  p_message        text DEFAULT NULL,
  p_meeting_location text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id     uuid := auth.uid();
  v_product       products%ROWTYPE;
  v_order_id      uuid;
  v_buyer_name    text;
  v_existing      uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.seller_id = v_caller_id THEN
    RAISE EXCEPTION 'You cannot reserve your own listing';
  END IF;

  IF v_product.status != 'active' THEN
    RAISE EXCEPTION 'This item is not available for reservation (status: %)', v_product.status;
  END IF;

  SELECT id INTO v_existing
    FROM orders
   WHERE buyer_id = v_caller_id
     AND product_id = p_product_id
     AND status IN ('pending', 'accepted')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'You already have an active reservation for this item';
  END IF;

  INSERT INTO orders (product_id, buyer_id, seller_id, status, quantity, message, meeting_location)
  VALUES (p_product_id, v_caller_id, v_product.seller_id, 'pending', 1, p_message, p_meeting_location)
  RETURNING id INTO v_order_id;

  SELECT name INTO v_buyer_name FROM profiles WHERE id = v_caller_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_product.seller_id,
    'order',
    'New Reservation Request!',
    v_buyer_name || ' wants to reserve "' || v_product.title || '".',
    '/dashboard/orders'
  );

  RETURN json_build_object('success', true, 'order_id', v_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_reservation(uuid, text, text) TO authenticated;
