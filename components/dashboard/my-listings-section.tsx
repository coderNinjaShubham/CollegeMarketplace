'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Edit3, Archive, CheckCircle, Clock, XCircle, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { formatPrice, timeAgo } from '@/lib/utils';
import type { ProductWithCategory, ProductStatus } from '@/lib/types';

interface MyListingsSectionProps {
  listings: ProductWithCategory[];
}

type FilterStatus = 'all' | ProductStatus;

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Reserved', value: 'reserved' },
  { label: 'Sold', value: 'sold' },
  { label: 'Removed', value: 'removed' },
];

const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; badge: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  active: { label: 'Active', badge: 'success' },
  reserved: { label: 'Reserved', badge: 'warning' },
  sold: { label: 'Sold', badge: 'destructive' },
  removed: { label: 'Removed', badge: 'secondary' },
};

export function MyListingsSection({ listings }: MyListingsSectionProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'all' ? listings : listings.filter((p) => p.status === filter);

  async function updateStatus(id: string, status: ProductStatus) {
    setActionId(id);
    setError('');
    const supabase = createClient();

    // Double ownership check on client — RLS also enforces on DB side
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated.'); setActionId(null); return; }

    const { error: updateError } = await supabase
      .from('products')
      .update({ status })
      .eq('id', id)
      .eq('seller_id', user.id); // extra ownership guard in the query itself

    if (updateError) {
      setError(`Could not update listing: ${updateError.message}`);
    } else {
      startTransition(() => router.refresh());
    }
    setActionId(null);
  }

  async function deleteListing(id: string) {
    if (!confirm('Are you sure you want to permanently delete this listing? It will be completely removed from your dashboard and the marketplace.')) {
      return;
    }
    setActionId(id);
    setError('');
    const supabase = createClient();
    const { error: delError } = await supabase.from('products').delete().eq('id', id);
    if (delError) {
      // If foreign key constraints restrict deletion (e.g. order history), set to removed
      await supabase.from('products').update({ status: 'removed' }).eq('id', id);
    }
    startTransition(() => router.refresh());
    setActionId(null);
  }

  const counts: Record<FilterStatus, number> = {
    all: listings.length,
    active: listings.filter((p) => p.status === 'active').length,
    reserved: listings.filter((p) => p.status === 'reserved').length,
    sold: listings.filter((p) => p.status === 'sold').length,
    removed: listings.filter((p) => p.status === 'removed').length,
  };

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">My Listings</h2>
          <p className="text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'} total
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/sell">
            <Plus className="h-4 w-4" /> List an item
          </Link>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              filter === value
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs leading-none">
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filter === 'all' ? "You have no listings" : `No ${filter} listings`}
          description={
            filter === 'all'
              ? 'List your first item and reach students across campus.'
              : `None of your listings have the status "${filter}".`
          }
          action={filter === 'all' ? { label: 'List an item', href: '/sell' } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => {
            const cfg = STATUS_CONFIG[product.status];
            const isLoading = actionId === product.id || isPending;
            return (
              <div key={product.id} className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Image */}
                <Link href={`/product/${product.id}`} className="block relative aspect-[4/3] overflow-hidden bg-muted">
                  <ProductImage path={product.image_url} alt={product.title} />
                  {product.status !== 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                        {cfg.label}
                      </span>
                    </div>
                  )}
                </Link>

                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    <span className="text-sm font-semibold text-primary">{formatPrice(product.price)}</span>
                  </div>
                  <h3 className="mb-1 line-clamp-1 text-sm font-medium">{product.title}</h3>
                  <p className="mb-3 text-xs text-muted-foreground">{timeAgo(product.created_at)}</p>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/sell/edit/${product.id}`}>
                        <Edit3 className="h-3 w-3" /> Edit
                      </Link>
                    </Button>

                    {product.status === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateStatus(product.id, 'reserved')}
                          className="flex-1 text-warning border-warning/30 hover:bg-warning/10"
                        >
                          <Clock className="h-3 w-3" /> Reserve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => deleteListing(product.id)}
                          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </>
                    )}

                    {product.status === 'reserved' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateStatus(product.id, 'sold')}
                          className="flex-1 text-success border-success/30 hover:bg-success/10"
                        >
                          <CheckCircle className="h-3 w-3" /> Mark Sold
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateStatus(product.id, 'active')}
                          className="flex-1"
                        >
                          <XCircle className="h-3 w-3" /> Unreserve
                        </Button>
                      </>
                    )}

                    {product.status === 'sold' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => deleteListing(product.id)}
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete Listing
                      </Button>
                    )}

                    {product.status === 'removed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateStatus(product.id, 'active')}
                          className="flex-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Relist
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => deleteListing(product.id)}
                          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
