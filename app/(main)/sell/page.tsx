'use client';

import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';

export default function SellPage() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState
          icon={Package}
          title="Sign in to sell"
          description="You need an account to list items on NITW Market."
          action={{
            label: 'Sign in',
            href: '/login?redirect=/sell',
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold">List an Item</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        The listing form will be added in Phase 3 when the database is ready.
      </p>
      <EmptyState
        icon={Package}
        title="Coming soon"
        description="The product listing form will be available once the database schema is set up in Phase 2."
      />
    </div>
  );
}
