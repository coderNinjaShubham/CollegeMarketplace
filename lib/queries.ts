import { createClient } from '@/lib/supabase/server';
import type { Product, ProductWithCategory, Category } from '@/lib/types';

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');
  if (error) return [];
  return data as Category[];
}

export async function getProductById(id: string): Promise<ProductWithCategory | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( name, slug )
    `)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProductWithCategory;
}

export async function getProductImages(productId: string): Promise<{ id: string; image_url: string; sort_order: number }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('product_images')
    .select('id, image_url, sort_order')
    .eq('product_id', productId)
    .order('sort_order');
  if (error || !data) return [];
  return data;
}

export async function getRecentProducts(limit = 8): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( name, slug )
    `)
    .in('status', ['active', 'reserved', 'sold'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as ProductWithCategory[];
}

export async function getProductsByCategory(slug: string): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( name, slug )
    `)
    .eq('categories.slug', slug)
    .in('status', ['active', 'reserved', 'sold'])
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ProductWithCategory[];
}

export async function searchProducts(query: string): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( name, slug )
    `)
    .in('status', ['active', 'reserved', 'sold'])
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ProductWithCategory[];
}

export async function getProductsBySeller(sellerId: string): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories ( name, slug )
    `)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ProductWithCategory[];
}
