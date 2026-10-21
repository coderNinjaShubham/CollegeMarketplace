'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Badge } from '@/components/ui/badge';
import { CONDITIONS, CATEGORIES, HOSTEL_BLOCKS } from '@/lib/constants';
import { separateProductsByHostel } from '@/lib/location';
import type { ProductWithCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

type ConditionFilter = string;
type SortOption = 'newest' | 'price_low' | 'price_high';

export function BrowsePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [userHostel, setUserHostel] = useState<string | null>(null);
  const [hostelFilter, setHostelFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Load authenticated user profile hostel once
  useEffect(() => {
    async function checkUserHostel() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('hostel_block')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.hostel_block) {
          setUserHostel(profile.hostel_block);
        }
      }
    }
    checkUserHostel();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const selectClause = categoryFilter
        ? '*, categories!inner( name, slug )'
        : '*, categories ( name, slug )';

      let dbQuery = supabase
        .from('products')
        .select(selectClause)
        .eq('status', 'active');

      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (categoryFilter) {
        dbQuery = dbQuery.eq('categories.slug', categoryFilter);
      }
      if (conditionFilter) {
        dbQuery = dbQuery.eq('condition', conditionFilter);
      }
      if (hostelFilter) {
        dbQuery = dbQuery.eq('seller_hostel_block', hostelFilter);
      }

      if (sortBy === 'price_low') {
        dbQuery = dbQuery.order('price', { ascending: true });
      } else if (sortBy === 'price_high') {
        dbQuery = dbQuery.order('price', { ascending: false });
      } else {
        dbQuery = dbQuery.order('created_at', { ascending: false });
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      setProducts((data as ProductWithCategory[]) || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
      setError('Could not load listings. Please try again.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [query, categoryFilter, conditionFilter, hostelFilter, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const hasFilters = query || categoryFilter || conditionFilter || hostelFilter;

  function clearFilters() {
    setCategoryFilter('');
    setConditionFilter('');
    setHostelFilter('');
    setSortBy('newest');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-bold">
          {query ? `Results for "${query}"` : 'Browse Marketplace'}
        </h1>
        <SearchBar defaultValue={query} />
        <CategoryNav />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="newest">Newest first</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>

        <select
          value={hostelFilter}
          onChange={(e) => setHostelFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All hostels</option>
          {HOSTEL_BLOCKS.map((h) => (
            <option key={h} value={h}>
              {h} {userHostel === h ? '(My Hostel)' : ''}
            </option>
          ))}
        </select>

        {userHostel && (
          <button
            type="button"
            onClick={() => setHostelFilter(hostelFilter === userHostel ? '' : userHostel)}
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium border transition-colors inline-flex items-center gap-1.5',
              hostelFilter === userHostel
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            )}
          >
            🏠 In My Hostel ({userHostel})
          </button>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}

        {!loading && products.length > 0 && (
          <span className={cn('ml-auto text-sm text-muted-foreground')}>
            {products.length} {products.length === 1 ? 'listing' : 'listings'}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={hasFilters ? 'No matches found' : 'No listings yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or filters.'
              : 'Be the first to list an item. Once listings are added, they will appear here.'
          }
          action={{
            label: 'List an item',
            href: '/sell',
          }}
        />
      ) : !hostelFilter && userHostel && separateProductsByHostel(products, userHostel).sameHostel.length > 0 ? (
        (() => {
          const { sameHostel, otherHostels } = separateProductsByHostel(products, userHostel);
          return (
            <div className="space-y-10">
              {/* Same-hostel section */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
                      🏠
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                          In Your Hostel ({userHostel})
                        </h3>
                        <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400 border-none text-[11px]">
                          Zero walk distance
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sameHostel.length} {sameHostel.length === 1 ? 'item' : 'items'} available right in your hostel block
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {sameHostel.map((product) => (
                    <ProductCard key={product.id} product={product} viewerHostel={userHostel} />
                  ))}
                </div>
              </div>

              {/* Other hostels section */}
              {otherHostels.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground">Other Hostels Across Campus</h3>
                    <span className="text-xs text-muted-foreground">{otherHostels.length} listings</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {otherHostels.map((product) => (
                      <ProductCard key={product.id} product={product} viewerHostel={userHostel} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} viewerHostel={userHostel} />
          ))}
        </div>
      )}
    </div>
  );
}
