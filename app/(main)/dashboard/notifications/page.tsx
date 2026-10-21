import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyProfile, getMyNotifications } from '@/lib/queries';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { NotificationsSection } from '@/components/dashboard/notifications-section';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/notifications');

  const [profile, notifications] = await Promise.all([
    getMyProfile(),
    getMyNotifications(),
  ]);

  return (
    <DashboardShell profile={profile} activeTab="notifications">
      <NotificationsSection notifications={notifications} />
    </DashboardShell>
  );
}
