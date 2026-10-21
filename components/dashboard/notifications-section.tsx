'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Package,
  ShoppingBag,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/lib/types';

interface NotificationsSectionProps {
  notifications: Notification[];
}

export function NotificationsSection({ notifications }: NotificationsSectionProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAsRead(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoadingId(null);
      return;
    }

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);

    startTransition(() => {
      router.refresh();
    });
    setLoadingId(null);
  }

  async function markAllAsRead() {
    setLoadingId('all');
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoadingId(null);
      return;
    }

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    startTransition(() => {
      router.refresh();
    });
    setLoadingId(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Alerts for your reservations, sales, and account activity
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={loadingId === 'all' || isPending}
            className="text-xs"
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
            {notifications.length}
          </span>
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? 'You have caught up with all your notifications.'
              : 'When someone requests your item or accepts your reservation, you will be notified here.'
          }
          action={filter === 'unread' ? undefined : { label: 'Explore marketplace', href: '/browse' }}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const isLoading = loadingId === item.id || (loadingId === 'all' && !item.is_read);

            return (
              <div
                key={item.id}
                className={`relative flex items-start gap-3 rounded-lg border p-4 transition-all ${
                  item.is_read
                    ? 'border-border bg-card'
                    : 'border-primary/30 bg-primary/5 shadow-sm'
                }`}
              >
                {/* Status Dot / Icon */}
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {item.type === 'order' ? (
                    <ShoppingBag className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm ${
                        item.is_read ? 'font-medium text-foreground' : 'font-semibold text-foreground'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>

                  {item.body && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {item.body}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {item.link && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={item.link}>
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View Details
                        </Link>
                      </Button>
                    )}

                    {!item.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(item.id)}
                        disabled={isLoading || isPending}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
