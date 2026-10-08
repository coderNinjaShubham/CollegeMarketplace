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
