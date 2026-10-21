'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Trash2, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { formatPrice, timeAgo } from '@/lib/utils';
import type { Favorite } from '@/lib/types';

interface SavedSectionProps {
  favorites: Favorite[];
}

export function SavedSection({ favorites }: SavedSectionProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function removeFavorite(favoriteId: string) {
    setRemoving(favoriteId);
    setError('');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated.'); setRemoving(null); return; }

    // RLS on favorites enforces user_id = auth.uid() — extra .eq() for clarity
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', user.id);

    if (deleteError) {
      setError(`Could not remove: ${deleteError.message}`);
    } else {
      startTransition(() => router.refresh());
    }
    setRemoving(null);
  }

  if (favorites.length === 0) {
    return (
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold">Saved Items</h2>
          <p className="text-sm text-muted-foreground">Products you&apos;ve bookmarked</p>
        </div>
        <EmptyState
          icon={Heart}
          title="No saved items yet"
          description="Tap the heart icon on any product to save it for later."
          action={{ label: 'Browse marketplace', href: '/browse' }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Saved Items</h2>
        <p className="text-sm text-muted-foreground">{favorites.length} saved {favorites.length === 1 ? 'item' : 'items'}</p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((fav) => {
          const product = fav.products as any;
          if (!product) return null;

          const isUnavailable = product.status !== 'active';

          return (
            <div key={fav.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <Link href={`/product/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-muted">
                <ProductImage path={product.image_url} alt={product.title} />
                {isUnavailable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white capitalize">
                      {product.status}
                    </span>
                  </div>
                )}
                {/* Heart indicator */}
                <div className="absolute top-2 right-2 rounded-full bg-black/40 p-1.5">
                  <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                </div>
              </Link>

              <div className="p-3">
                <Link href={`/product/${product.id}`} className="block">
                  <h3 className="line-clamp-1 text-sm font-medium hover:underline">{product.title}</h3>
                </Link>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">{formatPrice(product.price)}</span>
                  {product.categories?.name && (
                    <Badge variant="secondary" className="text-xs">{product.categories.name}</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Saved {timeAgo(fav.created_at)}</p>

                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/product/${product.id}`}>
                      <ExternalLink className="h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removing === fav.id || isPending}
                    onClick={() => removeFavorite(fav.id)}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
