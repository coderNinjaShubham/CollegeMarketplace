import { ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        description="When you reserve an item, it will appear here for you to track."
        action={{
          label: 'Browse marketplace',
          href: '/browse',
        }}
      />
    </div>
  );
}
