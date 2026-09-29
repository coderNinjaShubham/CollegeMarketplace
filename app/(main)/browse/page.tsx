import { Suspense } from 'react';
import { BrowsePage } from '@/components/browse-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading...</div>}>
      <BrowsePage />
    </Suspense>
  );
}
