'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, MapPin, MessageSquare, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/utils';

interface ReserveButtonProps {
  productId: string;
  productTitle: string;
  productPrice: number;
  sellerId: string;
}

export function ReserveButton({
  productId,
  productTitle,
  productPrice,
  sellerId,
}: ReserveButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleOpen() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/product/${productId}`);
      return;
    }
    if (user.id === sellerId) {
      setError("You can't reserve your own listing.");
      return;
    }
    setError('');
    setSuccess(false);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const supabase = createClient();

    // Call the SECURITY DEFINER function — validates everything server-side:
    // 1. caller != seller
    // 2. product is active
    // 3. no duplicate active reservation
    // 4. creates order + notifies seller atomically
    const { data, error: rpcError } = await supabase.rpc('create_reservation', {
      p_product_id: productId,
      p_message: message.trim() || null,
      p_meeting_location: meetingLocation.trim() || null,
    });

    if (rpcError) {
      if (rpcError.code === 'PGRST202') {
        // Fallback: direct table mutation if migration 010 function not yet created in Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError('Not authenticated.');
          setSubmitting(false);
          return;
        }

        // Prevent duplicate active reservation
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('buyer_id', user.id)
          .eq('product_id', productId)
          .in('status', ['pending', 'accepted'])
          .maybeSingle();

        if (existing) {
          setError('You already have a pending or accepted request for this item. Check your Orders.');
          setSubmitting(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('orders')
          .insert({
            product_id: productId,
            buyer_id: user.id,
            seller_id: sellerId,
            status: 'pending',
            quantity: 1,
            message: message.trim() || null,
            meeting_location: meetingLocation.trim() || null,
          });

        if (insertError) {
          setError(`Could not send request: ${insertError.message}`);
          setSubmitting(false);
          return;
        }
      } else {
        // Map DB exception messages to user-friendly text
        const msg = rpcError.message ?? '';
        if (msg.includes('already have an active reservation')) {
          setError('You already have a pending or accepted request for this item. Check your Orders.');
        } else if (msg.includes('not available for reservation')) {
          setError('This item is no longer available.');
        } else if (msg.includes('own listing')) {
          setError("You can't reserve your own listing.");
        } else {
          setError(`Could not send request: ${msg}`);
        }
        setSubmitting(false);
        return;
      }
    }

    setSuccess(true);
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  function handleClose() {
    setOpen(false);
    setMessage('');
    setMeetingLocation('');
    setError('');
    setSuccess(false);
  }

  return (
    <>
      <Button onClick={handleOpen} className="w-full" size="lg">
        <ShoppingBag className="h-4 w-4" /> Request to Reserve
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Request Item</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center">
            <div className="mb-3 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <ShoppingBag className="h-7 w-7 text-success" />
              </div>
            </div>
            <h3 className="mb-1 text-base font-semibold">Request Sent!</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              The seller has been notified. Track this in your Orders dashboard.
            </p>
            <Button onClick={handleClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="line-clamp-1 text-sm font-medium">{productTitle}</p>
              <p className="text-sm font-bold text-primary">{formatPrice(productPrice)}</p>
            </div>

            <div>
              <Label htmlFor="reserve-location">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                Suggested meeting place
              </Label>
              <Input
                id="reserve-location"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="e.g. Library, SAC, Main Gate…"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="reserve-message">
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
                Message{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="reserve-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, I'm interested in this item…"
                rows={3}
                className="mt-1 flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={submitting || isPending}
                className="flex-1"
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              The seller will accept or decline. You can cancel from your Orders
              page if needed.
            </p>
          </form>
        )}
      </Dialog>
    </>
  );
}
