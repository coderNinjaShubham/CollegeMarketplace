'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  showScore = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const starSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const currentVal = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onMouseLeave={() => !readOnly && setHoverValue(null)}
            className={cn(
              'p-0.5 transition-transform focus:outline-none',
              !readOnly && 'hover:scale-110 cursor-pointer',
              readOnly && 'cursor-default'
            )}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                starSizes[size],
                'transition-colors',
                star <= currentVal
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30 fill-transparent'
              )}
            />
          </button>
        ))}
      </div>

      {showScore && (
        <span className="text-xs font-semibold text-foreground">
          {value > 0 ? value.toFixed(1) : 'No ratings'}
        </span>
      )}
    </div>
  );
}
