import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCategories, getProductById } from '@/lib/queries';
import { ProductForm } from '@/components/product-form';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/sell/edit/${params.id}`);
  }

  const [categories, product] = await Promise.all([
    getCategories(),
    getProductById(params.id),
  ]);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={Package}
          title="Listing not found"
          description="This listing may have been removed, or the link is incorrect."
          action={{ label: 'Browse marketplace', href: '/browse' }}
          className="mx-auto max-w-md mt-12"
        />
      </div>
    );
  }

  if (product.seller_id !== user.id) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={Package}
          title="Not your listing"
          description="You can only edit listings that you created."
          action={{ label: 'Back to product', href: `/product/${params.id}` }}
          className="mx-auto max-w-md mt-12"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold">Edit Listing</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Update the details of your listing below.
      </p>
      <ProductForm mode="edit" categories={categories} product={product} />
    </div>
  );
}
