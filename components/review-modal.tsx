'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, X, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StarRating } from '@/components/star-rating';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  sellerId: string;
  productTitle: string;
  sellerName: string;
  onSuccess?: () => void;
}

export function ReviewModal({
  open,
  onClose,
  orderId,
  productId,
  sellerId,
  productTitle,
  sellerName,
  onSuccess,
}: ReviewModalProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }

    setSubmitting(true);
    setError('');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be signed in to submit a review.');
      setSubmitting(false);
      return;
    }

    // Insert into reviews table.
    // Database RLS enforces:
    // 1. auth.uid() = reviewer_id
    // 2. Order exists, status is completed, buyer_id = auth.uid()
    // 3. UNIQUE(order_id) prevents repeated reviews
    const { error: insertError } = await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: user.id,
      reviewee_id: sellerId,
      product_id: productId,
      rating,
      comment: comment.trim() || null,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        setError('You have already submitted a review for this completed order.');
      } else {
        setError(`Failed to submit review: ${insertError.message}`);
      }
      setSubmitting(false);
      return;
    }

    // Notify seller of review
    await supabase.from('notifications').insert({
      user_id: sellerId,
      type: 'review',
      title: 'New Review Received!',
      body: `A buyer gave you a ${rating}-star review for "${productTitle}".`,
      link: `/product/${productId}`,
    });

    setSubmitted(true);
    setSubmitting(false);
    onSuccess?.();
    startTransition(() => {
      router.refresh();
    });
  }

  function handleClose() {
    setSubmitted(false);
    setError('');
    setComment('');
    setRating(5);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Review Seller</h2>
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {submitted ? (
        <div className="py-6 text-center">
          <div className="mb-3 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
          </div>
          <h3 className="mb-1 text-base font-semibold">Review Submitted!</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Thank you for helping keep the NITW campus community reliable and trustworthy.
          </p>
          <Button onClick={handleClose} variant="outline" className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground uppercase font-medium">Transaction</p>
            <p className="text-sm font-semibold text-foreground line-clamp-1">{productTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Seller: {sellerName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Rating</label>
            <div className="flex items-center gap-3">
              <StarRating value={rating} onChange={setRating} size="lg" />
              <span className="text-sm font-medium text-foreground">
                {rating === 5 && 'Excellent'}
                {rating === 4 && 'Good'}
                {rating === 3 && 'Average'}
                {rating === 2 && 'Fair'}
                {rating === 1 && 'Poor'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="block text-sm font-medium mb-1.5">
              Feedback <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              placeholder="How was the item condition, communication, and exchange location?"
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="mt-1 text-[11px] text-muted-foreground text-right">
              {comment.length} / 2000
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting || isPending}
              className="flex-1"
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Reviews can only be submitted once per completed order to prevent manipulation.
          </p>
        </form>
      )}
    </Dialog>
  );
}
