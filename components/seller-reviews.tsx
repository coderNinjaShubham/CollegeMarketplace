'use client';

import { Star, MessageSquare } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { StarRating } from '@/components/star-rating';
import { timeAgo } from '@/lib/utils';
import type { Review } from '@/lib/types';

interface SellerReviewsProps {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export function SellerReviews({
  reviews,
  averageRating,
  totalReviews,
}: SellerReviewsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <span className="text-xl font-bold text-foreground">
              {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
            </span>
            <span className="text-xs text-muted-foreground">/ 5.0</span>
          </div>
          <span className="text-xs text-muted-foreground">
            ({totalReviews} verified {totalReviews === 1 ? 'review' : 'reviews'})
          </span>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">No reviews yet</p>
          <p className="text-xs text-muted-foreground">
            Reviews can be submitted by buyers after completing a campus exchange.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-lg border border-border bg-card p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    src={rev.reviewer_profile?.avatar_url || undefined}
                    fallback={rev.reviewer_profile?.name || 'Student'}
                    className="h-7 w-7"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {rev.reviewer_profile?.name || 'Verified Buyer'}
                    </p>
                    {rev.reviewer_profile?.branch && (
                      <p className="text-[10px] text-muted-foreground">
                        {rev.reviewer_profile.branch}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <StarRating value={rev.rating} readOnly size="sm" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {timeAgo(rev.created_at)}
                  </span>
                </div>
              </div>

              {rev.comment && (
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {rev.comment}
                </p>
              )}

              {rev.products?.title && (
                <p className="text-[10px] text-muted-foreground/80 italic">
                  Item: {rev.products.title}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
