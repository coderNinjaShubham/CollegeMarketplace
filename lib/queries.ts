import { createClient } from '@/lib/supabase/server';
import type { Product, ProductWithCategory, Category, Profile, Order, Favorite } from '@/lib/types';

// ─── Public queries (no auth needed) ──────────────────────────────────────────

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
    .select(`*, categories ( name, slug )`)
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
    .select(`*, categories ( name, slug )`)
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
    .select(`*, categories ( name, slug )`)
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
    .select(`*, categories ( name, slug )`)
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
    .select(`*, categories ( name, slug )`)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ProductWithCategory[];
}

// ─── Authenticated dashboard queries (server-side, session-scoped) ─────────────
// These MUST be called from Server Components where a session exists.
// RLS guarantees data isolation — a user can only see their own records.

/**
 * Get the current session user's own profile.
 * Returns null if not authenticated or profile not found.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, roll_number, branch, year, hostel_block, avatar_url, role, is_suspended, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

/**
 * Get all listings (all statuses) belonging to the current session user.
 * RLS policy on products: sellers see their own removed listings.
 */
export async function getMyListings(): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('products')
    .select(`*, categories ( name, slug )`)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ProductWithCategory[];
}

/**
 * Get orders where the current user is the BUYER (purchase history).
 * Joins product info + seller's non-sensitive public name for display.
 */
export async function getMyBuyerOrders(): Promise<Order[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      products ( id, title, price, image_url, status, categories ( name, slug ) ),
      seller_profile:profiles!orders_seller_id_fkey ( name, branch, year, hostel_block )
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as Order[];
}

/**
 * Get orders where the current user is the SELLER (incoming reservations).
 * Joins product info + buyer's non-sensitive public name.
 * Privacy: only shows name, branch, year, hostel_block — never email.
 */
export async function getMySellerOrders(): Promise<Order[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      products ( id, title, price, image_url, status, categories ( name, slug ) ),
      buyer_profile:profiles!orders_buyer_id_fkey ( name, branch, year, hostel_block )
    `)
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as Order[];
}

/**
 * Get the current user's saved/favorited products.
 * RLS: favorites.user_id = auth.uid() enforced at DB level.
 */
export async function getMyFavorites(): Promise<Favorite[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      *,
      products ( id, title, price, condition, status, image_url, categories ( name, slug ) )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as Favorite[];
}

/**
 * Check if a specific product is in the current user's favorites.
 * Returns the favorite ID if favorited, null if not.
 */
export async function getMyFavoriteStatus(productId: string): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();
  return data?.id ?? null;
}
