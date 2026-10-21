'use client';

import { useState } from 'react';
import { Flag, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: 'product' | 'user';
  targetId: string;
  targetTitle: string;
}

const REPORT_REASONS = [
  'Prohibited or restricted item (drugs, weapons, alcohol, etc.)',
  'Suspected scam, counterfeit, or fraudulent transaction',
  'Incorrect or misleading item description / stolen images',
  'Harassment, abusive communication, or inappropriate behavior',
  'Duplicate or spam listing',
  'Other violation of NITW marketplace guidelines',
];

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const [reasonCategory, setReasonCategory] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be signed in to submit a report.');
      setSubmitting(false);
      return;
    }

    const fullReason = details.trim()
      ? `${reasonCategory}: ${details.trim()}`
      : reasonCategory;

    // Insert into reports table
    // RLS ensures auth.uid() = reporter_id
    const { error: insertError } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: fullReason,
      status: 'pending',
    });

    if (insertError) {
      setError(`Failed to submit report: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  function handleClose() {
    setSubmitted(false);
    setError('');
    setDetails('');
    setReasonCategory(REPORT_REASONS[0]);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-destructive">
          <Flag className="h-5 w-5" />
          <h2 className="text-lg font-bold text-foreground">
            Report {targetType === 'product' ? 'Listing' : 'User'}
          </h2>
        </div>
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
          <h3 className="mb-1 text-base font-semibold">Report Received</h3>
          <p className="mb-4 text-xs text-muted-foreground max-w-sm mx-auto">
            Our student administration team will review this report and take appropriate action.
          </p>
          <Button onClick={handleClose} variant="outline" className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground uppercase font-medium">Reporting Target</p>
            <p className="text-sm font-semibold text-foreground line-clamp-1">{targetTitle}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Reason for report</label>
            <Select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="report-details" className="block text-sm font-medium mb-1.5">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="report-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1500}
              placeholder="Please provide any context or links to help administrators investigate."
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
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

          <div className="flex items-start gap-2 rounded-md bg-muted/60 p-2.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <span>
              False or malicious reporting is against campus guidelines and may lead to account penalties.
            </span>
          </div>
        </form>
      )}
    </Dialog>
  );
}
