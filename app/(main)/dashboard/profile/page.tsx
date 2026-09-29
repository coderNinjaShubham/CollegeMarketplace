'use client';

import { User as UserIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const { loading, profile, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12">
        <p className="text-center text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">My Profile</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>{profile?.name || 'Student'}</CardTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileField label="Roll Number" value={profile?.roll_number} />
          <ProfileField label="Branch" value={profile?.branch} />
          <ProfileField label="Year" value={profile?.year} />
          <ProfileField label="Hostel / Block" value={profile?.hostel_block} />
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        Profile editing will be available in Phase 4.
      </p>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || 'Not set'}</span>
    </div>
  );
}
