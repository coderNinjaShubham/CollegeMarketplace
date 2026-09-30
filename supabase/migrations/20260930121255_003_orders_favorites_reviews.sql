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
