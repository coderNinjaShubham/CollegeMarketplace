import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatPrice, timeAgo, cn } from '@/lib/utils';
import { getConditionLabel } from '@/lib/constants';

export interface ProductCardData {
  id: string;
  title: string;
  price: number;
  condition: string;
  status: string;
  image_url?: string | null;
  category_name?: string | null;
  seller_name?: string | null;
  created_at: string;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success' },
  reserved: { label: 'Reserved', className: 'bg-warning/10 text-warning' },
  sold: { label: 'Sold', className: 'bg-destructive/10 text-destructive' },
  removed: { label: 'Removed', className: 'bg-muted text-muted-foreground' },
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const badge = statusBadge[product.status] ?? statusBadge.active;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {product.status !== 'active' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium', badge.className)}>
              {badge.label}
            </span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="line-clamp-1 text-sm font-medium text-foreground">
          {product.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-primary">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs text-muted-foreground">
            {getConditionLabel(product.condition)}
          </span>
        </div>
        {product.category_name && (
          <p className="text-xs text-muted-foreground">{product.category_name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {timeAgo(product.created_at)}
        </p>
      </div>
    </Link>
  );
}
