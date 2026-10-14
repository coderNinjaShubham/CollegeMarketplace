'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Package, Heart, ShoppingBag, User as UserIcon, Edit3, Archive } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProductWithCategory } from '@/lib/types';

const dashboardSections = [
  { title: 'My Listings', description: 'Manage your active, reserved, and sold items', href: '/dashboard', icon: Package },
  { title: 'My Orders', description: 'Track your reservations and purchases', href: '/dashboard/orders', icon: ShoppingBag },
  { title: 'Saved Items', description: "Products you've favorited", href: '/dashboard/saved', icon: Heart },
  { title: 'Profile', description: 'Your marketplace profile and settings', href: '/dashboard/profile', icon: UserIcon },
];

export default function DashboardPage() {
  const { loading: authLoading, user, profile } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: queryError } = await createClient()
      .from('products')
      .select('*, categories ( name, slug )')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    if (queryError) setError('Could not load your listings.');
    setProducts((data as ProductWithCategory[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadListings(); }, [loadListings]);

  async function removeListing(id: string) {
    if (!window.confirm('Remove this listing from the marketplace?')) return;
    setActionId(id);
    setError('');
    const { error: updateError } = await createClient().from('products').update({ status: 'removed' }).eq('id', id);
    if (updateError) setError('Could not remove the listing.');
    else await loadListings();
    setActionId(null);
  }

  if (authLoading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  if (!user) {
    return <div className="mx-auto max-w-md py-12"><EmptyState icon={LayoutDashboard} title="Sign in to view your dashboard" description="Access your listings, orders, and saved items." action={{ label: 'Sign in', href: '/login?redirect=/dashboard' }} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6"><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-muted-foreground">Welcome back, {profile?.name || 'student'}</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardSections.map((section) => (
          <Link key={section.href} href={section.href} className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><section.icon className="h-4 w-4 text-primary" /></div>
            <h2 className="mb-1 font-semibold group-hover:text-primary">{section.title}</h2>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">My Listings</h2><p className="text-sm text-muted-foreground">{products.length} {products.length === 1 ? 'listing' : 'listings'}</p></div><Button asChild size="sm"><Link href="/sell">List an item</Link></Button></div>
      {error && <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : products.length === 0 ? <EmptyState icon={Package} title="You have no listings" description="List your first item and reach students across campus." action={{ label: 'List an item', href: '/sell' }} /> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="space-y-2">
              <ProductCard product={product} />
              <div className="flex items-center justify-between gap-2">
                <Badge variant={product.status === 'active' ? 'success' : product.status === 'removed' ? 'secondary' : 'warning'}>{product.status}</Badge>
                <div className="flex gap-1"><Button asChild variant="ghost" size="sm"><Link href={`/sell/edit/${product.id}`}><Edit3 className="h-4 w-4" /> Edit</Link></Button>{product.status !== 'removed' && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeListing(product.id)} disabled={actionId === product.id}><Archive className="h-4 w-4" /> Remove</Button>}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
