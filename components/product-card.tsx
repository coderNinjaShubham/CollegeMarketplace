import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { formatPrice, timeAgo, cn } from '@/lib/utils';
import { getConditionLabel } from '@/lib/constants';
import { isSameHostel } from '@/lib/location';
import type { ProductWithCategory } from '@/lib/types';
import { ProductImage } from '@/components/product-image';
import { FavoriteButton } from '@/components/favorite-button';

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: 'Available', className: 'bg-success/10 text-success' },
  reserved: { label: 'Reserved', className: 'bg-warning/10 text-warning' },
  sold: { label: 'Sold', className: 'bg-destructive/10 text-destructive' },
  removed: { label: 'Removed', className: 'bg-muted text-muted-foreground' },
};

interface ProductCardProps {
  product: ProductWithCategory;
  /** Pass current user's favorite state for this product (optional, defaults false) */
  isFavorited?: boolean;
  favoriteId?: string | null;
  /** Set to true when showing user's own listings — hides the favorite button */
  isOwnListing?: boolean;
  /** Pass the viewing user's hostel to highlight same-hostel listings */
  viewerHostel?: string | null;
}

export function ProductCard({
  product,
  isFavorited = false,
  favoriteId,
  isOwnListing = false,
  viewerHostel,
}: ProductCardProps) {
  const badge = statusBadge[product.status] ?? statusBadge.active;
  const categoryName = product.categories?.name ?? null;
  const isLocalHostel = Boolean(viewerHostel && isSameHostel(product.seller_hostel_block, viewerHostel));

  return (
    <Link
      href={`/product/${product.id}`}
      className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <ProductImage
          path={product.image_url}
          alt={product.title}
          imageClassName="transition-transform duration-300 group-hover:scale-105"
        />
        {product.status !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium', badge.className)}>
              {badge.label}
            </span>
          </div>
        )}
        {/* Same-hostel highlight badge */}
        {isLocalHostel && (
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              🏠 In Your Hostel
            </span>
          </div>
        )}
        {/* Favorite button — only shown for non-own listings */}
        {!isOwnListing && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <FavoriteButton
              productId={product.id}
              initialFavorited={isFavorited}
              initialFavoriteId={favoriteId}
            />
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-foreground">{product.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-primary">{formatPrice(product.price)}</span>
          <span className="text-xs text-muted-foreground">{getConditionLabel(product.condition)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          {product.seller_hostel_block ? (
            <span className={cn('flex items-center gap-1', isLocalHostel && 'font-medium text-emerald-600 dark:text-emerald-400')}>
              <MapPin className="h-3 w-3 shrink-0" />
              {product.seller_hostel_block}
            </span>
          ) : (
            <span>{categoryName || 'NITW'}</span>
          )}
          <span>{timeAgo(product.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
