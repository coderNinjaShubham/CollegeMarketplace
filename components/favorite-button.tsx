'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  productId: string;
  initialFavorited: boolean;
  initialFavoriteId?: string | null;
  className?: string;
}

export function FavoriteButton({
  productId,
  initialFavorited,
  initialFavoriteId,
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favoriteId, setFavoriteId] = useState<string | null>(initialFavoriteId ?? null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = useCallback(async (e: React.MouseEvent) => {
    // Don't bubble up to parent Link
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login, preserving intent
      router.push(`/login?redirect=/product/${productId}`);
      setLoading(false);
      return;
    }

    if (favorited && favoriteId) {
      // Remove — RLS enforces user_id = auth.uid()
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (!error) {
        setFavorited(false);
        setFavoriteId(null);
      }
    } else {
      // Add — RLS enforces user_id = auth.uid() on insert
      const { data, error } = await supabase
        .from('favorites')
        .insert({ product_id: productId, user_id: user.id })
        .select('id')
        .maybeSingle();

      if (!error && data) {
        setFavorited(true);
        setFavoriteId(data.id);
      }
    }

    setLoading(false);
  }, [favorited, favoriteId, loading, productId, router]);

  return (
    <button
      type="button"
      aria-label={favorited ? 'Remove from saved' : 'Save item'}
      aria-pressed={favorited}
      onClick={toggle}
      disabled={loading}
      className={cn(
        'rounded-full p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'bg-black/40 hover:bg-black/60 backdrop-blur-sm',
        loading && 'opacity-60 cursor-wait',
        className
      )}
    >
      <Heart
        className={cn(
          'h-4 w-4 transition-colors',
          favorited ? 'fill-red-500 text-red-500' : 'text-white'
        )}
      />
    </button>
  );
}
