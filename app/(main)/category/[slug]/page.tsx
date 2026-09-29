import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { getCategoryName } from '@/lib/constants';

export default function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const categoryName = getCategoryName(params.slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">{categoryName}</h1>
      <EmptyState
        icon={Package}
        title={`No ${categoryName.toLowerCase()} listed yet`}
        description="Check back later or be the first to list an item in this category."
        action={{
          label: 'List an item',
          href: '/sell',
        }}
      />
    </div>
  );
}
