'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit3, MapPin, Package, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { FavoriteButton } from '@/components/favorite-button';
import { ReserveButton } from '@/components/reserve-button';
import { formatPrice, timeAgo } from '@/lib/utils';
import { getConditionLabel } from '@/lib/constants';
import type { ProductImage as ProductImageRow, ProductWithCategory } from '@/lib/types';

interface ProductDetailPageProps {
  params: { id: string };
}

const statusLabels: Record<string, string> = {
  active: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  removed: 'Removed',
};

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [images, setImages] = useState<ProductImageRow[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError(false);
      const supabase = createClient();

      const [
        { data, error: productError },
        { data: imageData },
        { data: { user } },
      ] = await Promise.all([
        supabase.from('products').select('*, categories ( name, slug )').eq('id', params.id).maybeSingle(),
        supabase.from('product_images').select('*').eq('product_id', params.id).order('sort_order'),
        supabase.auth.getUser(),
      ]);

      if (productError || !data) {
        setError(true);
        setLoading(false);
        return;
      }

      const productData = data as ProductWithCategory;
      setProduct(productData);
      setImages((imageData as ProductImageRow[]) || []);
      setSelectedImage(productData.image_url || imageData?.[0]?.image_url || null);

      if (user) {
        setIsLoggedIn(true);
        setIsOwner(user.id === productData.seller_id);

        // Check favorite status — RLS scoped to auth.uid()
        const { data: favData } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', params.id)
          .maybeSingle();
        if (favData) {
          setIsFavorited(true);
          setFavoriteId(favData.id);
        }
      }

      setLoading(false);
    }

    loadProduct();
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>;
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={Package}
          title="Product not found"
          description="This listing may have been removed, or the link is incorrect."
          action={{ label: 'Browse marketplace', href: '/browse' }}
          className="mx-auto mt-12 max-w-md"
        />
      </div>
    );
  }

  const gallery = [product.image_url, ...images.map((img) => img.image_url)].filter(
    (path, index, all): path is string => Boolean(path) && all.indexOf(path) === index
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        {/* Image gallery */}
        <div>
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            <div className="aspect-[4/3]">
              <ProductImage path={selectedImage} alt={product.title} />
            </div>
            {/* Favorite button overlay */}
            {!isOwner && (
              <div className="absolute top-3 right-3">
                <FavoriteButton
                  productId={product.id}
                  initialFavorited={isFavorited}
                  initialFavoriteId={favoriteId}
                />
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {gallery.map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => setSelectedImage(path)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-muted ${selectedImage === path ? 'border-primary' : 'border-transparent'}`}
                >
                  <ProductImage path={path} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details panel */}
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={product.status === 'active' ? 'success' : product.status === 'reserved' ? 'warning' : 'destructive'}>
                {statusLabels[product.status]}
              </Badge>
              {product.categories?.name && <Badge variant="secondary">{product.categories.name}</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{product.title}</h1>
            <p className="mt-3 text-3xl font-bold text-primary">{formatPrice(product.price)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {getConditionLabel(product.condition)} · Listed {timeAgo(product.created_at)}
            </p>
          </div>

          <div className="border-y border-border py-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{product.description}</p>
          </div>

          {/* Seller card — only public info */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{product.seller_name || 'NITW student'}</p>
                <p className="text-sm text-muted-foreground">Seller</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {product.seller_branch && <p>{product.seller_branch}</p>}
              {product.seller_hostel_block && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />{product.seller_hostel_block}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {isOwner ? (
            <Button asChild className="w-full">
              <Link href={`/sell/edit/${product.id}`}>
                <Edit3 className="h-4 w-4" /> Edit listing
              </Link>
            </Button>
          ) : product.status === 'active' ? (
            <ReserveButton
              productId={product.id}
              productTitle={product.title}
              productPrice={product.price}
              sellerId={product.seller_id}
            />
          ) : (
            <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
              This item is {statusLabels[product.status].toLowerCase()} and no longer available for reservation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
