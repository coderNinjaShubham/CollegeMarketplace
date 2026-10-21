'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  BarChart3,
  Flag,
  Package,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketplaceStats, Report, ProductWithCategory, Profile } from '@/lib/types';
import { AdminOverview } from '@/components/admin/admin-overview';
import { AdminReports } from '@/components/admin/admin-reports';
import { AdminListings } from '@/components/admin/admin-listings';
import { AdminUsers } from '@/components/admin/admin-users';

interface AdminShellProps {
  stats: MarketplaceStats;
  reports: Report[];
  listings: ProductWithCategory[];
  users: Profile[];
}

type AdminTab = 'overview' | 'reports' | 'listings' | 'users';

export function AdminShell({ stats, reports, listings, users }: AdminShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Marketplace Administration
            </h1>
            <p className="text-xs text-muted-foreground">
              Campus trust, content moderation, user management, and safety controls
            </p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Dashboard
        </Link>
      </div>

      {/* Admin Nav Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'overview'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Overview & Analytics
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'reports'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Flag className="h-4 w-4" />
          Reports Queue
          {pendingReportsCount > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {pendingReportsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('listings')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'listings'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Package className="h-4 w-4" />
          Listings Moderation
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {listings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'users'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-4 w-4" />
          User Management
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {users.length}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <AdminOverview stats={stats} onNavigateTab={setActiveTab} />
      )}

      {activeTab === 'reports' && <AdminReports reports={reports} />}

      {activeTab === 'listings' && <AdminListings listings={listings} />}

      {activeTab === 'users' && <AdminUsers users={users} />}
    </div>
  );
}
