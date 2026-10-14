import Link from 'next/link';
import { ArrowRight, Package, Shield, Zap, Search, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { getRecentProducts } from '@/lib/queries';

export default async function HomePage() {
  const products = await getRecentProducts(8);

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
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Recently Listed</h2></div><Link href="/browse" className="text-sm text-primary hover:underline">See all <ArrowRight className="inline h-3.5 w-3.5" /></Link></div>{products.length === 0 ? <EmptyState icon={Package} title="No listings yet" description="Be the first to list an item on NITW Market." action={{ label: 'List the first item', href: '/sell' }} /> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section>
      <section className="border-t border-border bg-muted/20"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><h2 className="mb-8 text-center text-2xl font-bold">How it works</h2><div className="grid gap-6 sm:grid-cols-3"><HowItWorksStep icon={Package} title="List your item" description="Snap a photo, set a price, and post. It takes less than a minute." /><HowItWorksStep icon={Search} title="Find what you need" description="Search by category, price, or condition across campus listings." /><HowItWorksStep icon={Shield} title="Meet on campus" description="Connect with your batchmate and arrange a safe campus pickup." /></div></div></section>
    </div>
  );
}

function HowItWorksStep({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return <div className="rounded-lg border border-border bg-card p-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div><h3 className="mb-2 font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>;
}
