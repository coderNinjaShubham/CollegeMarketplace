import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyProfile, getMyListings } from '@/lib/queries';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { MyListingsSection } from '@/components/dashboard/my-listings-section';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Server-side auth guard — redirects before any DB query
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard');

  // Both queries are session-scoped via RLS
  const [profile, listings] = await Promise.all([
    getMyProfile(),
    getMyListings(),
  ]);

  return (
    <DashboardShell profile={profile} activeTab="listings">
      <MyListingsSection listings={listings} />
    </DashboardShell>
  );
}
