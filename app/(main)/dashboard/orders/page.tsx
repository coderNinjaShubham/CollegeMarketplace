import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyProfile, getMyBuyerOrders, getMySellerOrders } from '@/lib/queries';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { OrdersSection } from '@/components/dashboard/orders-section';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/orders');

  const [profile, buyerOrders, sellerOrders] = await Promise.all([
    getMyProfile(),
    getMyBuyerOrders(),
    getMySellerOrders(),
  ]);

  return (
    <DashboardShell profile={profile} activeTab="orders">
      <OrdersSection buyerOrders={buyerOrders} sellerOrders={sellerOrders} />
    </DashboardShell>
  );
}
