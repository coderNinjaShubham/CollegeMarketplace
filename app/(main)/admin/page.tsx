import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isAdmin,
  getAdminStats,
  getAdminReports,
  getAdminListings,
  getAdminUsers,
} from '@/lib/queries';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enforce server-side authentication
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  // Enforce server-side admin authorization (never trust client role)
  const isAuthorizedAdmin = await isAdmin();
  if (!isAuthorizedAdmin) {
    redirect('/dashboard?error=unauthorized');
  }

  // Load admin dataset server-side
  const [stats, reports, listings, users] = await Promise.all([
    getAdminStats(),
    getAdminReports(),
    getAdminListings(),
    getAdminUsers(),
  ]);

  return (
    <AdminShell
      stats={stats}
      reports={reports}
      listings={listings}
      users={users}
    />
  );
}
