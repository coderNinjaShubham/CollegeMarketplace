'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Package, Shield, Zap, Search, TrendingUp, Home as HomeIcon, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { HOSTEL_BLOCKS } from '@/lib/constants';
import { separateProductsByHostel } from '@/lib/location';
import type { ProductWithCategory } from '@/lib/types';

export default function HomePage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [userHostel, setUserHostel] = useState<string | null>(null);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const [productsRes, userRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories ( name, slug )')
          .in('status', ['active', 'reserved', 'sold'])
          .order('created_at', { ascending: false })
          .limit(16),
        supabase.auth.getUser(),
      ]);

      if (productsRes.error) {
        console.error('Failed to load recent products', productsRes.error);
        setError('Could not load recent listings. Please try again.');
      } else {
        setProducts((productsRes.data as ProductWithCategory[]) || []);
      }

      if (userRes.data?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('hostel_block')
          .eq('id', userRes.data.user.id)
          .maybeSingle();
        if (profile?.hostel_block) {
          setUserHostel(profile.hostel_block);
          setSelectedHostel(profile.hostel_block);
        }
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const activeHostel = selectedHostel || userHostel;
  const { sameHostel, otherHostels } = separateProductsByHostel(products, activeHostel);

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"><Zap className="h-3.5 w-3.5" /> NIT Warangal Student Marketplace</div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Buy from seniors.<br /><span className="text-primary">Sell to juniors.</span></h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">Textbooks, cycles, electronics, hostel items — everything you need, right from your batchmates on campus.</p>
            <div className="mx-auto mt-6 max-w-xl"><SearchBar placeholder="Search for textbooks, cycles, calculators..." /></div>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><Button asChild variant="accent" size="lg"><Link href="/sell"><Package className="h-4 w-4" /> List an Item</Link></Button><Button asChild variant="outline" size="lg"><Link href="/browse">Browse Marketplace <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </div>
      </section>

      <section className="border-b border-border"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Categories</h2><Link href="/browse" className="text-sm text-primary hover:underline">View all</Link></div><CategoryNav /></div></section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Listings</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>Prioritize hostel:</span>
            </div>
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Campus-wide</option>
              {HOSTEL_BLOCKS.map((h) => (
                <option key={h} value={h}>
                  {h} {userHostel === h ? '(Your Hostel)' : ''}
                </option>
              ))}
            </select>
            <Link href="/browse" className="text-sm text-primary hover:underline">
              See all <ArrowRight className="inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton count={4} />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>
        ) : products.length === 0 ? (
          <EmptyState icon={Package} title="No listings yet" description="Be the first to list an item on NITW Market." action={{ label: 'List the first item', href: '/sell' }} />
        ) : (
          <div className="space-y-10">
            {/* Same-hostel section — shown separately and before items from other hostels */}
            {activeHostel && sameHostel.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
                      🏠
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                          In Your Hostel ({activeHostel})
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
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewerHostel={activeHostel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other campus listings section */}
            <div>
              {activeHostel && sameHostel.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">Other Campus Listings</h3>
                  <span className="text-xs text-muted-foreground">{otherHostels.length} listings</span>
                </div>
              )}
              {otherHostels.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {otherHostels.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      viewerHostel={activeHostel}
                    />
                  ))}
                </div>
              ) : activeHostel && sameHostel.length > 0 ? (
                <p className="text-xs text-muted-foreground italic">All current listings are from {activeHostel}!</p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-border bg-muted/20"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><h2 className="mb-8 text-center text-2xl font-bold">How it works</h2><div className="grid gap-6 sm:grid-cols-3"><HowItWorksStep icon={Package} title="List your item" description="Snap a photo, set a price, and post. It takes less than a minute." /><HowItWorksStep icon={Search} title="Find what you need" description="Search by category, price, or condition across campus listings." /><HowItWorksStep icon={Shield} title="Meet on campus" description="Connect with your batchmate and arrange a safe campus pickup." /></div></div></section>
    </div>
  );
}

function HowItWorksStep({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return <div className="rounded-lg border border-border bg-card p-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div><h3 className="mb-2 font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>;
}
