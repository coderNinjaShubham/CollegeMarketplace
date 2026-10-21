'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, ExternalLink, Archive, CheckCircle, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { formatPrice, timeAgo } from '@/lib/utils';
import type { ProductWithCategory, ProductStatus } from '@/lib/types';

interface AdminListingsProps {
  listings: ProductWithCategory[];
}

export function AdminListings({ listings }: AdminListingsProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | ProductStatus>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = listings.filter((item) => {
    const matchesFilter = filter === 'all' ? true : item.status === filter;
    const matchesSearch =
      search.trim() === '' ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.seller_name && item.seller_name.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  async function updateListingStatus(productId: string, status: ProductStatus) {
    setActionId(productId);
    setMessage(null);
    const supabase = createClient();

    const { error } = await supabase
      .from('products')
      .update({ status })
      .eq('id', productId);

    if (error) {
      setMessage({ text: `Failed to update listing: ${error.message}`, error: true });
    } else {
      setMessage({ text: `Listing status changed to "${status}".` });
      startTransition(() => router.refresh());
    }
    setActionId(null);
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
          {(['all', 'active', 'reserved', 'sold', 'removed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === tab
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {tab === 'all'
                  ? listings.length
                  : listings.filter((l) => l.status === tab).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p
          className={`rounded-md p-3 text-xs ${
            message.error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success'
          }`}
        >
          {message.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No listings found"
          description="Try adjusting your filter or search criteria."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => {
                  const isLoading = actionId === product.id || isPending;

                  return (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                            <ProductImage path={product.image_url} alt={product.title} />
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <p className="font-medium text-foreground truncate">{product.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono">
                              {product.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {product.categories?.name || 'General'}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {product.seller_name || 'NITW student'}
                        </p>
                        {product.seller_branch && (
                          <p className="text-[10px] text-muted-foreground">
                            {product.seller_branch}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold text-primary">
                        {formatPrice(product.price)}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            product.status === 'active'
                              ? 'success'
                              : product.status === 'reserved'
                              ? 'warning'
                              : product.status === 'sold'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="capitalize text-[10px]"
                        >
                          {product.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {timeAgo(product.created_at)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <Link href={`/product/${product.id}`} target="_blank">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Link>
                          </Button>

                          {product.status !== 'removed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => updateListingStatus(product.id, 'removed')}
                              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <Archive className="h-3 w-3 mr-1" />
                              Take Down
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => updateListingStatus(product.id, 'active')}
                              className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
