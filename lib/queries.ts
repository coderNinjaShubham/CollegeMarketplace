import { createClient } from '@/lib/supabase/server';
import type {
  Product,
  ProductWithCategory,
  Category,
  Profile,
  Order,
  Favorite,
  Notification,
  Review,
  Report,
  ReportStatus,
  MarketplaceStats,
} from '@/lib/types';

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
    .select(`*, categories!inner( name, slug )`)
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

/**
 * Get the current user's notifications.
 * RLS: notifications.user_id = auth.uid() enforced at DB level.
 */
export async function getMyNotifications(limit = 30): Promise<Notification[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Notification[];
}

/**
 * Get count of unread notifications for current user.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error || count === null) return 0;
  return count;
}

// ─── Review & Rating queries ──────────────────────────────────────────────────

/**
 * Get public reviews for a seller with reviewer public profile.
 */
export async function getSellerReviews(sellerId: string): Promise<Review[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, order_id, reviewer_id, reviewee_id, product_id, rating, comment, created_at,
      reviewer_profile:profiles!reviews_reviewer_id_fkey ( name, branch, avatar_url ),
      products ( title )
    `)
    .eq('reviewee_id', sellerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as Review[];
}

/**
 * Get aggregated rating summary for a seller.
 */
export async function getSellerRatingSummary(sellerId: string): Promise<{
  averageRating: number;
  totalReviews: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', sellerId);

  if (error || !data || data.length === 0) {
    return { averageRating: 0, totalReviews: 0 };
  }

  const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
  const averageRating = Math.round((sum / data.length) * 10) / 10;

  return { averageRating, totalReviews: data.length };
}

/**
 * Check if a specific order already has a review.
 */
export async function getOrderReview(orderId: string): Promise<Review | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Review;
}

// ─── Admin-only queries (server-side role check enforced) ──────────────────────

/**
 * Server-side verification that the current session user is an admin.
 * Never trust client-side role claims.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return data?.role === 'admin';
}

/**
 * Overview analytics for the admin dashboard.
 */
export async function getAdminStats(): Promise<MarketplaceStats> {
  const supabase = createClient();
  if (!(await isAdmin())) {
    throw new Error('Not authorized: admin role required');
  }

  const [
    { count: totalUsers },
    { count: totalListings },
    { count: activeListings },
    { count: completedOrders },
    { count: pendingReports },
    { data: completedData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('products(price)').eq('status', 'completed'),
  ]);

  let totalVolume = 0;
  if (completedData) {
    for (const order of completedData) {
      const prod = order.products as any;
      if (prod?.price) totalVolume += prod.price;
    }
  }

  return {
    totalUsers: totalUsers ?? 0,
    totalListings: totalListings ?? 0,
    activeListings: activeListings ?? 0,
    completedOrders: completedOrders ?? 0,
    pendingReports: pendingReports ?? 0,
    totalVolume,
  };
}

/**
 * Fetch reports for admin moderation.
 */
export async function getAdminReports(statusFilter?: ReportStatus): Promise<Report[]> {
  const supabase = createClient();
  if (!(await isAdmin())) {
    throw new Error('Not authorized: admin role required');
  }

  let query = supabase
    .from('reports')
    .select(`
      *,
      reporter_profile:profiles!reports_reporter_id_fkey ( name, email )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as Report[];
}

/**
 * Fetch all listings for admin moderation.
 */
export async function getAdminListings(): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  if (!(await isAdmin())) {
    throw new Error('Not authorized: admin role required');
  }

  const { data, error } = await supabase
    .from('products')
    .select('*, categories ( name, slug )')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as ProductWithCategory[];
}

/**
 * Fetch all user profiles for admin management.
 */
export async function getAdminUsers(): Promise<Profile[]> {
  const supabase = createClient();
  if (!(await isAdmin())) {
    throw new Error('Not authorized: admin role required');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Profile[];
}


