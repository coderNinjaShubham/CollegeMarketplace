'use client';

import { Users, Package, ShoppingBag, Flag, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import type { MarketplaceStats } from '@/lib/types';

interface AdminOverviewProps {
  stats: MarketplaceStats;
  onNavigateTab: (tab: 'overview' | 'reports' | 'listings' | 'users') => void;
}

export function AdminOverview({ stats, onNavigateTab }: AdminOverviewProps) {
  const cards = [
    {
      title: 'Total Students',
      value: stats.totalUsers,
      sub: 'Verified NITW community accounts',
      icon: Users,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      title: 'Active Listings',
      value: stats.activeListings,
      sub: `${stats.totalListings} listings total across campus`,
      icon: Package,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: 'Completed Exchanges',
      value: stats.completedOrders,
      sub: 'Successful student transactions',
      icon: ShoppingBag,
      color: 'text-indigo-500 bg-indigo-500/10',
    },
    {
      title: 'Pending Reports',
      value: stats.pendingReports,
      sub: stats.pendingReports > 0 ? 'Requires administrative review' : 'No pending flags',
      icon: Flag,
      color: stats.pendingReports > 0 ? 'text-rose-500 bg-rose-500/10' : 'text-muted-foreground bg-muted',
    },
    {
      title: 'Gross Exchange Volume',
      value: formatPrice(stats.totalVolume),
      sub: 'Estimated marketplace value circulated',
      icon: TrendingUp,
      color: 'text-amber-500 bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {c.title}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground">{c.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Moderation Alert Banner */}
      {stats.pendingReports > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {stats.pendingReports} student {stats.pendingReports === 1 ? 'report' : 'reports'} awaiting review
              </p>
              <p className="text-xs text-muted-foreground">
                Investigate flagged listings or reported student accounts to maintain campus safety.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onNavigateTab('reports')}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
          >
            Review Queue
          </Button>
        </div>
      )}

      {/* Quick Administration Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Quick Moderation Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigateTab('reports')}
            className="flex flex-col items-start rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 font-medium text-xs mb-1">
              <Flag className="h-3.5 w-3.5 text-rose-500" />
              <span>Review Reports</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Resolve or dismiss user and listing violations.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('listings')}
            className="flex flex-col items-start rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 font-medium text-xs mb-1">
              <Package className="h-3.5 w-3.5 text-emerald-500" />
              <span>Moderate Listings</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Inspect all marketplace inventory and take down inappropriate posts.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('users')}
            className="flex flex-col items-start rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 font-medium text-xs mb-1">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span>User Directory</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Inspect student profiles and suspend abusive accounts.
            </p>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
