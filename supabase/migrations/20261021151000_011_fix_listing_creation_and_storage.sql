-- Migration 011: Fix listing creation permissions and storage bucket
--
-- 1. Grants EXECUTE on set_product_seller_snapshot() to authenticated so that
--    trigger execution does not fail with "permission denied for function set_product_seller_snapshot".
-- 2. Grants INSERT on products columns (including seller_id and status) to authenticated.
-- 3. Creates/ensures the 'product-images' storage bucket exists and is public.
-- 4. Re-applies storage RLS policies for upload, read, update, and delete.

-- ─── 1. Fix trigger execution permissions ────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.set_product_seller_snapshot() TO authenticated;

-- ─── 2. Fix column-level privileges on products ─────────────────────────────
GRANT INSERT (id, seller_id, category_id, title, description, price, condition, status, image_url)
  ON products TO authenticated;

GRANT UPDATE (category_id, title, description, price, condition, status, image_url)
  ON products TO authenticated;

-- ─── 3. Ensure product-images storage bucket exists ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- Public so product photos load smoothly
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- ─── 4. Re-apply storage policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "product_images_read_public" ON storage.objects;
CREATE POLICY "product_images_read_public"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert_own_folder" ON storage.objects;
CREATE POLICY "product_images_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

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

DROP POLICY IF EXISTS "product_images_delete_own_folder" ON storage.objects;
CREATE POLICY "product_images_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
