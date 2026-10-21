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
  AlertCircle,
  Star,
  Flag,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { ReviewModal } from '@/components/review-modal';
import { ReportModal } from '@/components/report-modal';
import { formatPrice, timeAgo } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';

interface OrdersSectionProps {
  buyerOrders: Order[];
  sellerOrders: Order[];
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    badge: 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
    icon: React.ElementType;
    description: string;
  }
> = {
  pending: {
    label: 'Pending',
    badge: 'warning',
    icon: Clock,
    description: 'Waiting for seller response',
  },
  accepted: {
    label: 'Accepted',
    badge: 'success',
    icon: CheckCircle2,
    description: 'Seller accepted — arrange pickup',
  },
  rejected: {
    label: 'Declined',
    badge: 'destructive',
    icon: XCircle,
    description: 'Seller declined this request',
  },
  completed: {
    label: 'Completed',
    badge: 'secondary',
    icon: CheckCircle2,
    description: 'Exchange completed',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'secondary',
    icon: Ban,
    description: 'Reservation was cancelled',
  },
};

export function OrdersSection({ buyerOrders, sellerOrders }: OrdersSectionProps) {
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function transition(orderId: string, newStatus: OrderStatus) {
    setActionId(orderId);
    setError('');
    const supabase = createClient();

    // All validation, ownership checks, product-status sync, and notifications
    // are handled server-side by the SECURITY DEFINER function.
    const { error: rpcError } = await supabase.rpc('process_order_transition', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    if (rpcError) {
      if (rpcError.code === 'PGRST202') {
        // Fallback: direct table mutation if migration 010 function not yet created in Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError('Not authenticated.');
          setActionId(null);
          return;
        }

        // Fetch order to verify participation and product
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('*, products(id, status)')
          .eq('id', orderId)
          .maybeSingle();

        if (orderFetchError || !orderData) {
          setError('Order not found.');
          setActionId(null);
          return;
        }

        const isBuyer = user.id === orderData.buyer_id;
        const isSeller = user.id === orderData.seller_id;

        if (!isBuyer && !isSeller) {
          setError('Not authorized: you are not a participant in this order.');
          setActionId(null);
          return;
        }

        // Validate state transitions
        if (orderData.status === 'pending') {
          if ((newStatus === 'accepted' || newStatus === 'rejected') && !isSeller) {
            setError('Only the seller can accept or reject a pending reservation.');
            setActionId(null);
            return;
          }
          if (newStatus === 'cancelled' && !isBuyer) {
            setError('Only the buyer can cancel their own reservation.');
            setActionId(null);
            return;
          }
        } else if (orderData.status === 'accepted') {
          if (newStatus === 'cancelled' && !isBuyer) {
            setError('Only the buyer can cancel an accepted reservation.');
            setActionId(null);
            return;
          }
        } else {
          setError(`Order in status "${orderData.status}" cannot be modified.`);
          setActionId(null);
          return;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: newStatus,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          })
          .eq('id', orderId);

        if (updateError) {
          setError(`Could not update order: ${updateError.message}`);
        } else {
          // Sync product status
          if (newStatus === 'accepted') {
            await supabase
              .from('products')
              .update({ status: 'reserved' })
              .eq('id', orderData.product_id)
              .eq('status', 'active');
          } else if (newStatus === 'cancelled' || newStatus === 'rejected') {
            await supabase
              .from('products')
              .update({ status: 'active' })
              .eq('id', orderData.product_id)
              .eq('status', 'reserved');
          } else if (newStatus === 'completed') {
            await supabase
              .from('products')
              .update({ status: 'sold' })
              .eq('id', orderData.product_id);
          }
          startTransition(() => router.refresh());
        }
      } else {
        const msg = rpcError.message ?? '';
        if (msg.includes('Not authorized') || msg.includes('Only the')) {
          setError(`Not allowed: ${msg}`);
        } else if (msg.includes('cannot be transitioned')) {
          setError('This order has already reached a final state.');
        } else {
          setError(`Action failed: ${msg}`);
        }
      }
    } else {
      startTransition(() => router.refresh());
    }
    setActionId(null);
  }

  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    type: 'product' | 'user';
    id: string;
    title: string;
  } | null>(null);

  const pendingSellerCount = sellerOrders.filter((o) => o.status === 'pending').length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Orders & Reservations</h2>
        <p className="text-sm text-muted-foreground">
          Track your reservations and manage incoming inquiries
        </p>
      </div>

      {/* Tab selector */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setTab('buyer')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'buyer'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Reservations
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
            {buyerOrders.length}
          </span>
        </button>
        <button
          onClick={() => setTab('seller')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'seller'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Incoming Requests
          {pendingSellerCount > 0 && (
            <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-white">
              {pendingSellerCount}
            </span>
          )}
          {pendingSellerCount === 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {sellerOrders.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'buyer' && (
        <BuyerOrdersList
          orders={buyerOrders}
          actionId={actionId}
          onCancel={(id) => transition(id, 'cancelled')}
          onComplete={(id) => transition(id, 'completed')}
          onReview={(order) => setReviewOrder(order)}
          onReport={(order) =>
            setReportTarget({
              type: 'product',
              id: order.product_id,
              title: (order.products as any)?.title || 'Order item',
            })
          }
        />
      )}

      {tab === 'seller' && (
        <SellerOrdersList
          orders={sellerOrders}
          actionId={actionId}
          onAccept={(id) => transition(id, 'accepted')}
          onReject={(id) => transition(id, 'rejected')}
          onComplete={(id) => transition(id, 'completed')}
          onReport={(order) =>
            setReportTarget({
              type: 'user',
              id: order.buyer_id,
              title: (order.buyer_profile as any)?.name || 'Buyer',
            })
          }
        />
      )}

      {/* Review Modal for completed buyer orders */}
      {reviewOrder && (
        <ReviewModal
          open={Boolean(reviewOrder)}
          onClose={() => setReviewOrder(null)}
          orderId={reviewOrder.id}
          productId={reviewOrder.product_id}
          sellerId={reviewOrder.seller_id}
          productTitle={(reviewOrder.products as any)?.title || 'Marketplace Item'}
          sellerName={(reviewOrder.seller_profile as any)?.name || 'Seller'}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          open={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetTitle={reportTarget.title}
        />
      )}
    </div>
  );
}

// ─── Buyer's view ──────────────────────────────────────────────────────────────

function BuyerOrdersList({
  orders,
  actionId,
  onCancel,
  onComplete,
  onReview,
  onReport,
}: {
  orders: Order[];
  actionId: string | null;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  onReview: (order: Order) => void;
  onReport: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No reservations yet"
        description="When you request an item, it will appear here for you to track."
        action={{ label: 'Browse marketplace', href: '/browse' }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const cfg = STATUS_CONFIG[order.status];
        const StatusIcon = cfg.icon;
        const product = order.products as any;
        const seller = order.seller_profile as any;
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

                <p className="text-xs text-muted-foreground mb-1">{cfg.description}</p>

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

                {/* Seller info — public only */}
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

                {order.meeting_location && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Meet at: {order.meeting_location}
                  </div>
                )}
                {order.message && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="line-clamp-1">{order.message}</span>
                  </div>
                )}

                {/* Buyer actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(order.status === 'pending' || order.status === 'accepted') && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => onCancel(order.id)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Ban className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  )}
                  {order.status === 'accepted' && (
                    <Button
                      size="sm"
                      disabled={isLoading}
                      onClick={() => onComplete(order.id)}
                      className="bg-success hover:bg-success/90 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Completion
                    </Button>
                  )}
                  {order.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReview(order)}
                      className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-400" /> Leave Review
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReport(order)}
                    className="text-xs text-muted-foreground hover:text-destructive ml-auto"
                  >
                    <Flag className="h-3 w-3 mr-1" /> Report
                  </Button>
                </div>
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
  onReport,
}: {
  orders: Order[];
  actionId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onComplete: (id: string) => void;
  onReport: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No incoming requests"
        description="When a student wants to buy your item, their request will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const cfg = STATUS_CONFIG[order.status];
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

                {/* Buyer info — public fields only, never email */}
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
                    <p className="mb-0.5 font-medium text-muted-foreground">Message:</p>
                    <p>{order.message}</p>
                  </div>
                )}
                {order.meeting_location && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Suggested meet: {order.meeting_location}
                  </div>
                )}

                {/* Seller actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {order.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        disabled={isLoading}
                        onClick={() => onAccept(order.id)}
                        className="bg-success hover:bg-success/90 text-white"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => onReject(order.id)}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Decline
                      </Button>
                    </>
                  )}
                  {order.status === 'accepted' && (
                    <Button
                      size="sm"
                      disabled={isLoading}
                      onClick={() => onComplete(order.id)}
                      className="bg-success hover:bg-success/90 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Completed
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReport(order)}
                    className="text-xs text-muted-foreground hover:text-destructive ml-auto"
                  >
                    <Flag className="h-3 w-3 mr-1" /> Report Buyer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
