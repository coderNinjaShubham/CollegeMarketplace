'use client';

import { useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { EmptyState } from '@/components/empty-state';

export function BrowsePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-bold">
          {query ? `Results for "${query}"` : 'Browse Marketplace'}
        </h1>
        <SearchBar defaultValue={query} />
        <CategoryNav />
      </div>

      {/* Filters placeholder — will be expanded in Phase 3 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">Filters will be added in Phase 3.</span>
      </div>

      <EmptyState
        icon={Package}
        title="No listings found"
        description="Be the first to list an item. Once listings are added, they'll appear here."
        action={{
          label: 'List an item',
          href: '/sell',
        }}
      />
    </div>
  );
}
