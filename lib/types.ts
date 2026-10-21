export type ProductStatus = 'active' | 'reserved' | 'sold' | 'removed';
export type ProductCondition = 'brand_new' | 'like_new' | 'good' | 'fair' | 'needs_repair';
export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type UserRole = 'user' | 'admin';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
  year: string | null;
  hostel_block: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateData {
  name: string;
  roll_number: string | null;
  branch: string | null;
  year: string | null;
  hostel_block: string | null;
  avatar_url?: string | null;
}

export interface Product {
  id: string;
  seller_id: string;
  category_id: number;
  title: string;
  description: string;
  price: number;
  condition: ProductCondition;
  status: ProductStatus;
  image_url: string | null;
  view_count: number;
  seller_name: string | null;
  seller_branch: string | null;
  seller_hostel_block: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCategory extends Product {
  categories: { name: string; slug: string } | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

export interface ProductFormData {
  category_id: number;
  title: string;
  description: string;
  price: number;
  condition: ProductCondition;
  image_url: string | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  products?: ProductWithCategory | null;
}

export interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  quantity: number;
  message: string | null;
  meeting_location: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  products?: ProductWithCategory | null;
  buyer_profile?: {
    name: string;
    branch: string | null;
    year: string | null;
    hostel_block: string | null;
  } | null;
  seller_profile?: {
    name: string;
    branch: string | null;
    year: string | null;
    hostel_block: string | null;
  } | null;
}

export type NotificationType = 'order' | 'review' | 'report' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_profile?: {
    name: string;
    branch: string | null;
    avatar_url: string | null;
  } | null;
  products?: {
    title: string;
  } | null;
}

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'product' | 'user';
  target_id: string;
  reason: string;
  status: ReportStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reporter_profile?: {
    name: string;
    email: string;
  } | null;
  product_target?: {
    id: string;
    title: string;
    status: ProductStatus;
    seller_id: string;
  } | null;
  user_target?: {
    id: string;
    name: string;
    email: string;
    is_suspended: boolean;
  } | null;
}

export interface MarketplaceStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  completedOrders: number;
  pendingReports: number;
  totalVolume: number;
}

