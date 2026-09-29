import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <EmptyState
        icon={Package}
        title="Product not found"
        description="This listing may have been removed, or the link is incorrect. Browse the marketplace for available items."
        action={{
          label: 'Browse marketplace',
          href: '/browse',
        }}
        className="mx-auto max-w-md mt-12"
      />
    </div>
  );
}
