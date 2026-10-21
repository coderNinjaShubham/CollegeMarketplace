'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchCount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const [{ count: notifCount }, { count: pendingOrdersCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id)
          .eq('status', 'pending'),
      ]);

      if (isMounted) {
        const total = (notifCount || 0) + (pendingOrdersCount || 0);
        setUnreadCount(total);
      }
    }

    fetchCount();

    // Check count on route changes (e.g. after marking as read on dashboard)
  }, [pathname]);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label="View notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
