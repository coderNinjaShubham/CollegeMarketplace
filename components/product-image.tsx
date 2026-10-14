'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  path: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
}

export function ProductImage({ path, alt, className, imageClassName }: ProductImageProps) {
  const [url, setUrl] = useState<string | null>(path && path.startsWith('http') ? path : null);

  useEffect(() => {
    let active = true;
    if (!path || path.startsWith('http')) return;

    createClient()
      .storage
      .from('product-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });

    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-muted', className)}>
        <Package className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={cn('h-full w-full object-cover', imageClassName, className)} />
  );
}
