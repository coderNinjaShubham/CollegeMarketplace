'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Ban, CheckCircle, Search, Shield, UserX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/empty-state';
import { timeAgo } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface AdminUsersProps {
  users: Profile[];
}

export function AdminUsers({ users }: AdminUsersProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'admins'>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = users.filter((u) => {
    let matchesFilter = true;
    if (filter === 'active') matchesFilter = !u.is_suspended;
    else if (filter === 'suspended') matchesFilter = u.is_suspended;
    else if (filter === 'admins') matchesFilter = u.role === 'admin';

    const q = search.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.roll_number && u.roll_number.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  async function toggleSuspension(userId: string, targetSuspension: boolean) {
    setActionId(userId);
    setMessage(null);
    const supabase = createClient();

    const { error: rpcError } = await supabase.rpc('set_user_suspended', {
      p_target_user: userId,
      p_suspended: targetSuspension,
    });

    if (rpcError) {
      if (rpcError.code === 'PGRST202') {
        // Fallback: direct table update
        const { error: directError } = await supabase
          .from('profiles')
          .update({ is_suspended: targetSuspension })
          .eq('id', userId);

        if (directError) {
          setMessage({ text: `Failed: ${directError.message}`, error: true });
        } else {
          setMessage({
            text: `User account has been ${targetSuspension ? 'suspended' : 're-activated'}.`,
          });
          startTransition(() => router.refresh());
        }
      } else {
        setMessage({ text: `Failed: ${rpcError.message}`, error: true });
      }
    } else {
      setMessage({
        text: `User account has been ${targetSuspension ? 'suspended' : 're-activated'}.`,
      });
      startTransition(() => router.refresh());
    }
    setActionId(null);
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
          {(['all', 'active', 'suspended', 'admins'] as const).map((tab) => (
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
                {tab === 'all'
                  ? users.length
                  : tab === 'active'
                  ? users.filter((u) => !u.is_suspended).length
                  : tab === 'suspended'
                  ? users.filter((u) => u.is_suspended).length
                  : users.filter((u) => u.role === 'admin').length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p
          className={`rounded-md p-3 text-xs ${
            message.error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success'
          }`}
        >
          {message.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users match filter"
          description="Try clearing search or changing the filter."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Branch & Year</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => {
                  const isLoading = actionId === user.id || isPending;

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={user.avatar_url || undefined}
                            fallback={user.name || user.email}
                            className="h-8 w-8"
                          />
                          <div>
                            <p className="font-semibold text-foreground">{user.name}</p>
                            <p className="text-[11px] text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {user.roll_number || '—'}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {user.branch ? (
                          <div>
                            <p>{user.branch}</p>
                            {user.year && (
                              <p className="text-[10px] text-muted-foreground/80">{user.year}</p>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                          className="text-[10px] capitalize"
                        >
                          {user.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                          {user.role}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        {user.is_suspended ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Active
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {timeAgo(user.created_at)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {user.role !== 'admin' && (
                          <>
                            {!user.is_suspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => toggleSuspension(user.id, true)}
                                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => toggleSuspension(user.id, false)}
                                className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Unsuspend
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
