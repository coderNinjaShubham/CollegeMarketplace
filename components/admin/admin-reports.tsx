'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Flag,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Clock,
  ExternalLink,
  Ban,
  PackageX,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { timeAgo } from '@/lib/utils';
import type { Report, ReportStatus } from '@/lib/types';

interface AdminReportsProps {
  reports: Report[];
}

const REPORT_STATUS_BADGES: Record<
  ReportStatus,
  { label: string; badge: 'warning' | 'default' | 'success' | 'secondary' }
> = {
  pending: { label: 'Pending', badge: 'warning' },
  reviewing: { label: 'Reviewing', badge: 'default' },
  resolved: { label: 'Resolved', badge: 'success' },
  dismissed: { label: 'Dismissed', badge: 'secondary' },
};

export function AdminReports({ reports }: AdminReportsProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  async function updateReport(reportId: string, status: ReportStatus) {
    setLoadingId(reportId);
    setActionMessage(null);
    const supabase = createClient();
    const notes = adminNotes[reportId] || null;

    // Call update_report_status RPC
    const { error: rpcError } = await supabase.rpc('update_report_status', {
      p_report_id: reportId,
      p_status: status,
      p_admin_notes: notes,
    });

    if (rpcError) {
      if (rpcError.code === 'PGRST202') {
        // Fallback: direct table update
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { error: directError } = await supabase
          .from('reports')
          .update({
            status,
            admin_notes: notes,
            resolved_by: ['resolved', 'dismissed'].includes(status) ? user?.id : null,
            resolved_at: ['resolved', 'dismissed'].includes(status) ? new Date().toISOString() : null,
          })
          .eq('id', reportId);

        if (directError) {
          setActionMessage({ text: `Failed: ${directError.message}`, error: true });
        } else {
          setActionMessage({ text: `Report status updated to "${status}".` });
          setNotesOpen(null);
          startTransition(() => router.refresh());
        }
      } else {
        setActionMessage({ text: `Failed: ${rpcError.message}`, error: true });
      }
    } else {
      setActionMessage({ text: `Report status updated to "${status}".` });
      setNotesOpen(null);
      startTransition(() => router.refresh());
    }
    setLoadingId(null);
  }

  async function removeProductTarget(reportId: string, productId: string) {
    setLoadingId(reportId);
    const supabase = createClient();

    const { error } = await supabase
      .from('products')
      .update({ status: 'removed' })
      .eq('id', productId);

    if (error) {
      setActionMessage({ text: `Could not remove product: ${error.message}`, error: true });
    } else {
      // Also resolve report
      await updateReport(reportId, 'resolved');
      setActionMessage({ text: 'Listing removed and report resolved.' });
    }
    setLoadingId(null);
  }

  async function suspendUserTarget(reportId: string, userId: string) {
    setLoadingId(reportId);
    const supabase = createClient();

    const { error: rpcError } = await supabase.rpc('set_user_suspended', {
      p_target_user: userId,
      p_suspended: true,
    });

    if (rpcError) {
      if (rpcError.code === 'PGRST202') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_suspended: true })
          .eq('id', userId);

        if (updateError) {
          setActionMessage({ text: `Failed to suspend user: ${updateError.message}`, error: true });
        } else {
          await updateReport(reportId, 'resolved');
          setActionMessage({ text: 'User suspended and report resolved.' });
        }
      } else {
        setActionMessage({ text: `Failed to suspend user: ${rpcError.message}`, error: true });
      }
    } else {
      await updateReport(reportId, 'resolved');
      setActionMessage({ text: 'User suspended and report resolved.' });
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
          {(['all', 'pending', 'reviewing', 'resolved', 'dismissed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === tab
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {tab === 'all' ? reports.length : reports.filter((r) => r.status === tab).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <p
          className={`rounded-md p-3 text-xs ${
            actionMessage.error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success'
          }`}
        >
          {actionMessage.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No reports in this view"
          description="Reports submitted by students will appear here for administrative investigation."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const isLoading = loadingId === report.id || isPending;
            const badge = REPORT_STATUS_BADGES[report.status] || REPORT_STATUS_BADGES.pending;

            return (
              <div
                key={report.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={badge.badge}>{badge.label}</Badge>
                      <span className="text-xs font-semibold uppercase text-primary">
                        {report.target_type === 'product' ? 'Listing Flag' : 'User Flag'}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(report.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Reported by:{' '}
                      <span className="font-medium text-foreground">
                        {report.reporter_profile?.name || 'Anonymous student'}
                      </span>{' '}
                      ({report.reporter_profile?.email || report.reporter_id})
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {report.target_type === 'product' && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={`/product/${report.target_id}`} target="_blank">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View Listing
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reason description */}
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                    Reported Issue
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{report.reason}</p>
                </div>

                {report.admin_notes && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 text-xs">
                    <p className="font-semibold text-primary mb-0.5">Admin Resolution Notes:</p>
                    <p className="text-muted-foreground">{report.admin_notes}</p>
                  </div>
                )}

                {/* Notes Input Drawer when resolving */}
                {notesOpen === report.id && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="block text-xs font-medium">Add resolution remarks:</label>
                    <textarea
                      rows={2}
                      value={adminNotes[report.id] || ''}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                      }
                      placeholder="e.g. Warning issued / Listing taken down / No violation found"
                      className="flex w-full resize-none rounded-md border border-input bg-background p-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                  {report.status !== 'reviewing' && report.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => updateReport(report.id, 'reviewing')}
                      className="h-8 text-xs"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Mark Reviewing
                    </Button>
                  )}

                  {report.status !== 'resolved' && (
                    <>
                      {notesOpen === report.id ? (
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateReport(report.id, 'resolved')}
                          className="h-8 text-xs bg-success hover:bg-success/90 text-white"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Confirm Resolution
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => setNotesOpen(report.id)}
                          className="h-8 text-xs text-success border-success/30 hover:bg-success/10"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Resolve Report
                        </Button>
                      )}
                    </>
                  )}

                  {report.status !== 'dismissed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => updateReport(report.id, 'dismissed')}
                      className="h-8 text-xs text-muted-foreground"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  )}

                  {/* High Impact Direct Moderation */}
                  {report.target_type === 'product' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => removeProductTarget(report.id, report.target_id)}
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                    >
                      <PackageX className="mr-1.5 h-3.5 w-3.5" />
                      Take Down Listing
                    </Button>
                  )}

                  {report.target_type === 'user' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => suspendUserTarget(report.id, report.target_id)}
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      Suspend User Account
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
