import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyProfile } from '@/lib/queries';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ProfileSection } from '@/components/dashboard/profile-section';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/profile');

  const profile = await getMyProfile();
  if (!profile) redirect('/login?redirect=/dashboard/profile');

  return (
    <DashboardShell profile={profile} activeTab="profile">
      <ProfileSection profile={profile} />
    </DashboardShell>
  );
}
