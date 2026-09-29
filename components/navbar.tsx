'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Store,
  Plus,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Heart,
  Package,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { SearchBar } from '@/components/search-bar';
import { CategoryNav } from '@/components/category-nav';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Top bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-bold text-foreground">NITW Market</span>
            <p className="-mt-0.5 text-[10px] text-muted-foreground">
              Buy from seniors. Sell to juniors.
            </p>
          </div>
        </Link>

        {/* Desktop search */}
        <div className="hidden flex-1 max-w-xl md:block">
          <SearchBar />
        </div>

        {/* Desktop nav actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="accent" size="sm" className="hidden sm:flex">
            <Link href="/sell">
              <Plus className="h-4 w-4" />
              Sell
            </Link>
          </Button>

          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted"
              >
                <Avatar
                  src={profile?.avatar_url || undefined}
                  fallback={profile?.name || user.email || 'U'}
                  className="h-8 w-8"
                />
                <span className="hidden text-sm font-medium lg:block max-w-[100px] truncate">
                  {profile?.name || 'Profile'}
                </span>
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-scale-in">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-medium truncate">{profile?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <DropdownLink href="/dashboard" icon={Package} label="My Listings" />
                    <DropdownLink href="/dashboard/saved" icon={Heart} label="Saved Items" />
                    <DropdownLink href="/dashboard/profile" icon={UserIcon} label="Profile" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-md p-2 hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Desktop category nav */}
      <div className="hidden border-t border-border md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <CategoryNav className="py-2.5" />
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-slide-up">
          <div className="space-y-3 p-4">
            <SearchBar />
            <CategoryNav className="flex-col" />
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Button asChild variant="accent" size="default">
                <Link href="/sell">
                  <Plus className="h-4 w-4" />
                  Sell an Item
                </Link>
              </Button>
              {!loading && !user && (
                <>
                  <Button asChild variant="outline">
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
              {!loading && user && (
                <>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/dashboard/profile">Profile</Link>
                  </Button>
                  <Button variant="ghost" onClick={handleSignOut} className="justify-start text-destructive">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function DropdownLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}
