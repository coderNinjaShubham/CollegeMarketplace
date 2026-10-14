'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { CONDITIONS, CATEGORIES } from '@/lib/constants';
import type { ProductWithCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

type ConditionFilter = string;
type SortOption = 'newest' | 'price_low' | 'price_high';

export function BrowsePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      let dbQuery = supabase
        .from('products')
        .select(`*, categories ( name, slug )`)
        .in('status', ['active', 'reserved', 'sold']);

      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (categoryFilter) {
        dbQuery = dbQuery.eq('categories.slug', categoryFilter);
      }
      if (conditionFilter) {
        dbQuery = dbQuery.eq('condition', conditionFilter);
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
  }, [query, categoryFilter, conditionFilter, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const hasFilters = query || categoryFilter || conditionFilter;

  function clearFilters() {
    setCategoryFilter('');
    setConditionFilter('');
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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
