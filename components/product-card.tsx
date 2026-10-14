import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatPrice, timeAgo, cn } from '@/lib/utils';
import { getConditionLabel } from '@/lib/constants';
import type { ProductWithCategory } from '@/lib/types';
import { ProductImage } from '@/components/product-image';

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: 'Available', className: 'bg-success/10 text-success' },
  reserved: { label: 'Reserved', className: 'bg-warning/10 text-warning' },
  sold: { label: 'Sold', className: 'bg-destructive/10 text-destructive' },
  removed: { label: 'Removed', className: 'bg-muted text-muted-foreground' },
};

export function ProductCard({ product }: { product: ProductWithCategory }) {
  const badge = statusBadge[product.status] ?? statusBadge.active;
  const categoryName = product.categories?.name ?? null;

  return (
    <Link href={`/product/${product.id}`} className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <ProductImage path={product.image_url} alt={product.title} imageClassName="transition-transform duration-300 group-hover:scale-105" />
        {product.status !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium', badge.className)}>{badge.label}</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-foreground">{product.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-primary">{formatPrice(product.price)}</span>
          <span className="text-xs text-muted-foreground">{getConditionLabel(product.condition)}</span>
        </div>
        {categoryName && <p className="text-xs text-muted-foreground">{categoryName}</p>}
        <p className="text-xs text-muted-foreground">{timeAgo(product.created_at)}</p>
      </div>
    </Link>
  );
}
