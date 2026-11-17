'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { BrandLogo } from '@/components/brand-logo';
import { ModeToggle } from '@/components/layout/mode-toggle';
import { authClient } from '@/lib/auth/client';
import { initials } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/verification', label: 'Verification', icon: BadgeCheck, badge: 'pending' as const },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

async function signOut() {
  await authClient.signOut().catch(() => {});
  window.location.href = '/login';
}

export function AdminShell({
  user,
  pendingCount,
  children,
}: {
  user: { name: string; email: string };
  pendingCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const badge = (key?: 'pending') =>
    key === 'pending' && pendingCount > 0 ? (
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-status-warning/15 px-1.5 text-[10px] font-semibold text-status-warning tabular-nums">
        {pendingCount > 99 ? '99+' : pendingCount}
      </span>
    ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <Link href="/admin" aria-label="Admin dashboard" className="flex items-center">
            <BrandLogo className="h-8" priority />
          </Link>
        </div>
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-xs font-medium text-primary">
            <ShieldCheck className="size-4" />
            Platform admin
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Manage
          </p>
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity',
                        active ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <item.icon className="size-4" />
                    {item.label}
                    {badge(item.badge)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="my-4 border-t border-sidebar-border" />
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <ArrowUpRight className="size-4" />
            Open my workspace
          </Link>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials(user.name, user.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user.name || 'Admin'}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
            <Link href="/admin" className="flex items-center lg:hidden" aria-label="Admin dashboard">
              <BrandLogo className="h-7" />
            </Link>
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
              <ShieldCheck className="size-4 text-primary" />
              Admin console
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/dashboard"
                className="hidden h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex lg:hidden"
              >
                <ArrowUpRight className="size-4" /> Workspace
              </Link>
              <ModeToggle />
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </div>
          {/* Mobile nav */}
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.badge === 'pending' && pendingCount > 0 ? (
                    <span className="rounded-full bg-status-warning/15 px-1.5 text-[10px] font-semibold text-status-warning tabular-nums">
                      {pendingCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
