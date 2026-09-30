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
