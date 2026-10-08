import { getProductsByCategory, getCategories } from '@/lib/queries';
import { getCategoryName } from '@/lib/constants';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const categoryName = getCategoryName(params.slug);
  const [products] = await Promise.all([
    getProductsByCategory(params.slug),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">{categoryName}</h1>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={`No ${categoryName.toLowerCase()} listed yet`}
          description="Check back later or be the first to list an item in this category."
          action={{
            label: 'List an item',
            href: '/sell',
          }}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? 'listing' : 'listings'} in {categoryName}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
