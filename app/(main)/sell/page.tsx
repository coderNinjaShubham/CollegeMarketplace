import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCategories } from '@/lib/queries';
import { ProductForm } from '@/components/product-form';

export default async function SellPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/sell');
  }

  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold">List an Item</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Fill in the details below to post your item on the marketplace.
      </p>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
