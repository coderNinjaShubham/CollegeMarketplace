export type ProductStatus = 'active' | 'reserved' | 'sold' | 'removed';
export type ProductCondition = 'brand_new' | 'like_new' | 'good' | 'fair' | 'needs_repair';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
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
