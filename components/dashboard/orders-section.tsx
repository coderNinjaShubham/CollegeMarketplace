'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  MapPin,
  MessageSquare,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { formatPrice, timeAgo } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';

interface OrdersSectionProps {
  buyerOrders: Order[];
  sellerOrders: Order[];
}

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badge: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ElementType }
> = {
  pending: { label: 'Pending', badge: 'warning', icon: Clock },
  accepted: { label: 'Accepted', badge: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', badge: 'destructive', icon: XCircle },
  completed: { label: 'Completed', badge: 'secondary', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', badge: 'secondary', icon: Ban },
};

export function OrdersSection({ buyerOrders, sellerOrders }: OrdersSectionProps) {
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateOrderStatus(orderId: string, status: OrderStatus, role: 'buyer' | 'seller') {
    setActionId(orderId);
    setError('');
    const supabase = createClient();

    // Verify auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated.'); setActionId(null); return; }

    // Build query — RLS on orders restricts to buyer_id or seller_id = auth.uid()
    const col = role === 'buyer' ? 'buyer_id' : 'seller_id';
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .eq(col, user.id); // extra ownership check in query

    if (updateError) {
      setError(`Could not update order: ${updateError.message}`);
    } else {
      startTransition(() => router.refresh());
    }
    setActionId(null);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Orders</h2>
        <p className="text-sm text-muted-foreground">Track your reservations and incoming inquiries</p>
      </div>

      {/* Tab selector */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setTab('buyer')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'buyer' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Purchases
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{buyerOrders.length}</span>
        </button>
        <button
          onClick={() => setTab('seller')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'seller' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Incoming Requests
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{sellerOrders.length}</span>
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {tab === 'buyer' && (
        <BuyerOrdersList
          orders={buyerOrders}
          actionId={actionId}
          onCancel={(id) => updateOrderStatus(id, 'cancelled', 'buyer')}
        />
      )}

      {tab === 'seller' && (
        <SellerOrdersList
          orders={sellerOrders}
          actionId={actionId}
          onAccept={(id) => updateOrderStatus(id, 'accepted', 'seller')}
          onReject={(id) => updateOrderStatus(id, 'rejected', 'seller')}
          onComplete={(id) => updateOrderStatus(id, 'completed', 'seller')}
        />
      )}
    </div>
  );
}

// ─── Buyer's view ─────────────────────────────────────────────────────────────

function BuyerOrdersList({
  orders,
  actionId,
  onCancel,
}: {
  orders: Order[];
  actionId: string | null;
  onCancel: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No purchases yet"
        description="When you reserve an item, it will appear here."
        action={{ label: 'Browse marketplace', href: '/browse' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const cfg = ORDER_STATUS_CONFIG[order.status];
        const StatusIcon = cfg.icon;
        const product = order.products as any;
        const seller = order.seller_profile as any;
        const isLoading = actionId === order.id;

        return (
          <div key={order.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex gap-4">
              {/* Product thumbnail */}
              {product && (
                <Link
                  href={`/product/${product.id}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
                >
                  <ProductImage path={product.image_url} alt={product.title} />
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={cfg.badge}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {cfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</span>
                </div>

                {product && (
                  <Link
                    href={`/product/${product.id}`}
                    className="block font-medium hover:underline line-clamp-1"
                  >
                    {product.title}
                  </Link>
                )}
                <p className="mt-0.5 text-sm font-semibold text-primary">
                  {product ? formatPrice(product.price) : '—'}
                </p>

                {/* Seller info — public fields only */}
                {seller && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" />
                    <span>{seller.name}</span>
                    {seller.hostel_block && (
                      <>
                        <MapPin className="h-3 w-3" />
                        <span>{seller.hostel_block}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Meeting details */}
                {order.meeting_location && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Meet at: {order.meeting_location}</span>
                  </div>
                )}
                {order.message && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="line-clamp-1">{order.message}</span>
                  </div>
                )}

                {/* Actions */}
                {order.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => onCancel(order.id)}
                    className="mt-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Ban className="h-3 w-3" /> Cancel request
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Seller's incoming requests view ──────────────────────────────────────────

function SellerOrdersList({
  orders,
  actionId,
  onAccept,
  onReject,
  onComplete,
}: {
  orders: Order[];
  actionId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No incoming requests"
        description="When a student wants to buy your item, you'll see their request here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const cfg = ORDER_STATUS_CONFIG[order.status];
        const StatusIcon = cfg.icon;
        const product = order.products as any;
        const buyer = order.buyer_profile as any;
        const isLoading = actionId === order.id;

        return (
          <div key={order.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex gap-4">
              {product && (
                <Link
                  href={`/product/${product.id}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
                >
                  <ProductImage path={product.image_url} alt={product.title} />
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={cfg.badge}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {cfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</span>
                </div>

                {product && (
                  <Link
                    href={`/product/${product.id}`}
                    className="block font-medium hover:underline line-clamp-1"
                  >
                    {product.title}
                  </Link>
                )}
                <p className="mt-0.5 text-sm font-semibold text-primary">
                  {product ? formatPrice(product.price) : '—'}
                </p>

                {/* Buyer info — public fields only, no email */}
                {buyer && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3 w-3" />
                      <span className="font-medium text-foreground">{buyer.name}</span>
                      {buyer.branch && <span>· {buyer.branch}</span>}
                    </div>
                    {buyer.hostel_block && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{buyer.hostel_block}</span>
                      </div>
                    )}
                  </div>
                )}

                {order.message && (
                  <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs">
                    <p className="mb-0.5 text-muted-foreground font-medium">Message:</p>
                    <p>{order.message}</p>
                  </div>
                )}
                {order.meeting_location && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Suggested meet: {order.meeting_location}</span>
                  </div>
                )}

                {/* Actions — seller controls */}
                {order.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={isLoading}
                      onClick={() => onAccept(order.id)}
                      className="bg-success hover:bg-success/90 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => onReject(order.id)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                )}
                {order.status === 'accepted' && (
                  <Button
                    size="sm"
                    disabled={isLoading}
                    onClick={() => onComplete(order.id)}
                    className="mt-3 bg-success hover:bg-success/90 text-white"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Mark as Completed
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
