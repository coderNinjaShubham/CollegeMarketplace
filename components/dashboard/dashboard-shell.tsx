'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Heart, ShoppingBag, User as UserIcon, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface DashboardShellProps {
  profile: Profile | null;
  children: React.ReactNode;
  activeTab?: string;
}

const NAV = [
  { label: 'My Listings', href: '/dashboard', icon: Package, tab: 'listings' },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingBag, tab: 'orders' },
  { label: 'Saved', href: '/dashboard/saved', icon: Heart, tab: 'saved' },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, tab: 'notifications' },
  { label: 'Profile', href: '/dashboard/profile', icon: UserIcon, tab: 'profile' },
];

export function DashboardShell({ profile, children, activeTab }: DashboardShellProps) {
  const pathname = usePathname();

  const isActive = (tab: string, href: string) => {
    if (activeTab) return activeTab === tab;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {profile?.name || 'student'}
        </p>
      </div>

      {/* Nav tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {NAV.map(({ label, href, icon: Icon, tab }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              isActive(tab, href)
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
