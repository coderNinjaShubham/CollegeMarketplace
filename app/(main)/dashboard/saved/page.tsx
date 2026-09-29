import { Heart } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default function SavedItemsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">Saved Items</h1>
      <EmptyState
        icon={Heart}
        title="No saved items yet"
        description="Tap the heart icon on any product to save it for later."
        action={{
          label: 'Browse marketplace',
          href: '/browse',
        }}
      />
    </div>
  );
}
