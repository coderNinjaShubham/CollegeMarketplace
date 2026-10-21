import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyProfile, getMyFavorites } from '@/lib/queries';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { SavedSection } from '@/components/dashboard/saved-section';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/saved');

  const [profile, favorites] = await Promise.all([
    getMyProfile(),
    getMyFavorites(),
  ]);

  return (
    <DashboardShell profile={profile} activeTab="saved">
      <SavedSection favorites={favorites} />
    </DashboardShell>
  );
}
