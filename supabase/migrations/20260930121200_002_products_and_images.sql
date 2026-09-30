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
