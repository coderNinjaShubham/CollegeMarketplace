'use client';

import { LayoutDashboard, Package, Heart, ShoppingBag, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/empty-state';

const dashboardSections = [
  {
    title: 'My Listings',
    description: 'Manage your active, reserved, and sold items',
    href: '/dashboard',
    icon: Package,
  },
  {
    title: 'My Orders',
    description: 'Track your reservations and purchases',
    href: '/dashboard/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Saved Items',
    description: 'Products you\'ve favorited',
    href: '/dashboard/saved',
    icon: Heart,
  },
  {
    title: 'Profile',
    description: 'Your marketplace profile and settings',
    href: '/dashboard/profile',
    icon: UserIcon,
  },
];

export default function DashboardPage() {
  const { loading, user, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState
          icon={LayoutDashboard}
          title="Sign in to view your dashboard"
          description="Access your listings, orders, and saved items."
          action={{
            label: 'Sign in',
            href: '/login?redirect=/dashboard',
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {profile?.name || 'student'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {dashboardSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <h2 className="mb-1 font-semibold group-hover:text-primary transition-colors">
              {section.title}
            </h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Package}
          title="Full dashboard coming in Phase 4"
          description="Listing management, order tracking, and saved items will be fully functional once the database is set up."
          className="max-w-lg"
        />
      </div>
    </div>
  );
}
