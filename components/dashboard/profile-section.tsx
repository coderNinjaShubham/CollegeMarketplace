'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Edit3, Save, X, GraduationCap, Home, Hash } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BRANCHES, YEARS, HOSTEL_BLOCKS } from '@/lib/constants';
import type { Profile, ProfileUpdateData } from '@/lib/types';

interface ProfileSectionProps {
  profile: Profile;
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || <span className="text-muted-foreground italic">Not set</span>}</span>
    </div>
  );
}

export function ProfileSection({ profile }: ProfileSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState<ProfileUpdateData>({
    name: profile.name ?? '',
    roll_number: profile.roll_number ?? '',
    branch: profile.branch ?? '',
    year: profile.year ?? '',
    hostel_block: profile.hostel_block ?? '',
  });

  function handleChange(field: keyof ProfileUpdateData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');

    const supabase = createClient();
    // Get current user — never trust client-passed IDs
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated.'); setSaving(false); return; }

    // Only update safe columns — role/is_suspended are DB-revoked from authenticated role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: form.name.trim(),
        roll_number: form.roll_number || null,
        branch: form.branch || null,
        year: form.year || null,
        hostel_block: form.hostel_block || null,
      })
      .eq('id', user.id); // ownership pinned to session user — RLS also enforces this

    if (updateError) {
      setError(`Failed to save: ${updateError.message}`);
    } else {
      setSuccess('Profile updated!');
      setEditing(false);
      router.refresh(); // re-fetch server component data
    }
    setSaving(false);
  }

  function handleCancel() {
    setForm({
      name: profile.name ?? '',
      roll_number: profile.roll_number ?? '',
      branch: profile.branch ?? '',
      year: profile.year ?? '',
      hostel_block: profile.hostel_block ?? '',
    });
    setEditing(false);
    setError('');
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">My Profile</h2>
          <p className="text-sm text-muted-foreground">Your public marketplace identity</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit3 className="h-4 w-4" /> Edit profile
          </Button>
        )}
      </div>

      {/* Avatar & email header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <UserIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{profile.name || 'Student'}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-md bg-success/10 p-3 text-sm text-success">{success}</p>
      )}

      <Card>
        <CardContent className="pt-5">
          {editing ? (
            // ── Edit form ────────────────────────────────────
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Your full name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="roll_number">Roll Number</Label>
                <div className="relative mt-1">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="roll_number"
                    value={form.roll_number ?? ''}
                    onChange={(e) => handleChange('roll_number', e.target.value)}
                    placeholder="e.g. 22CS1A0501"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="branch">Branch</Label>
                <div className="relative mt-1">
                  <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select
                    id="branch"
                    value={form.branch ?? ''}
                    onChange={(e) => handleChange('branch', e.target.value)}
                    className="pl-9"
                  >
                    <option value="">Select branch</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="year">Year</Label>
                <Select
                  id="year"
                  value={form.year ?? ''}
                  onChange={(e) => handleChange('year', e.target.value)}
                  className="mt-1"
                >
                  <option value="">Select year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="hostel_block">Hostel / Block</Label>
                <div className="relative mt-1">
                  <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select
                    id="hostel_block"
                    value={form.hostel_block ?? ''}
                    onChange={(e) => handleChange('hostel_block', e.target.value)}
                    className="pl-9"
                  >
                    <option value="">Select hostel block</option>
                    {HOSTEL_BLOCKS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={saving} className="flex-1">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Your email address cannot be changed here. Contact support if needed.
              </p>
            </div>
          ) : (
            // ── Read-only view ───────────────────────────────
            <div>
              <ProfileField label="Full Name" value={profile.name} />
              <ProfileField label="Roll Number" value={profile.roll_number} />
              <ProfileField label="Branch" value={profile.branch} />
              <ProfileField label="Year" value={profile.year} />
              <ProfileField label="Hostel / Block" value={profile.hostel_block} />
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground">Account role</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                  {profile.role}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Your name, branch and hostel block are visible to other students on your listings.
        Roll number is private and only visible to you.
      </p>
    </div>
  );
}
