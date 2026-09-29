'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function CategoryNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-hide pb-1',
        className
      )}
    >
      <Link
        href="/browse"
        className={cn(
          'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          pathname === '/browse'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-secondary'
        )}
      >
        All
      </Link>
      {CATEGORIES.map((cat) => {
        const Icon = (Icons[cat.icon as keyof typeof Icons] as LucideIcon) || Icons.Package;
        const href = `/category/${cat.slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={cat.slug}
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {cat.name}
          </Link>
        );
      })}
    </nav>
  );
}
