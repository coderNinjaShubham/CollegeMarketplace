import { getProductsByCategory, getCategories, getMyProfile } from '@/lib/queries';
import { getCategoryName } from '@/lib/constants';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { CategoryNav } from '@/components/category-nav';
import { Badge } from '@/components/ui/badge';
import { separateProductsByHostel } from '@/lib/location';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const categoryName = getCategoryName(params.slug);
  const [products, myProfile] = await Promise.all([
    getProductsByCategory(params.slug),
    getMyProfile(),
    getCategories(),
  ]);

  const userHostel = myProfile?.hostel_block || null;
  const { sameHostel, otherHostels } = separateProductsByHostel(products, userHostel);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-bold">{categoryName}</h1>
        <CategoryNav />
      </div>

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
      ) : userHostel && sameHostel.length > 0 ? (
        <div className="space-y-10">
          <p className="text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? 'listing' : 'listings'} in {categoryName}
          </p>

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
                <h3 className="text-base font-bold text-foreground">
                  From Other Hostels in {categoryName}
                </h3>
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
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? 'listing' : 'listings'} in {categoryName}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} viewerHostel={userHostel} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
