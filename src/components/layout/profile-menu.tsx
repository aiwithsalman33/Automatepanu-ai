"use client";

import Link from "next/link";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import type { AccountRole } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/ui/person-avatar";

const ROLE_BADGE: Record<AccountRole, { key: string; variant: "warning" | "soft" | "secondary" | "outline" }> = {
  owner: { key: "roleOwner", variant: "warning" },
  admin: { key: "roleAdmin", variant: "soft" },
  agent: { key: "roleAgent", variant: "secondary" },
  viewer: { key: "roleViewer", variant: "outline" },
};

/** Workspace name + the user's role there (role is always shown). */
export function WorkspaceLine() {
  const t = useTranslations("Sidebar");
  const { account, accountRole } = useAuth();
  if (!account?.name && !accountRole) return null;
  const role = accountRole ? ROLE_BADGE[accountRole] : null;
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate" title={account?.name}>
        {account?.name}
      </span>
      {role ? (
        <Badge variant={role.variant} className="ml-auto shrink-0">
          {t(role.key)}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * The account menu at the bottom of the rail: who you are, which
 * workspace and role, then Profile, Settings, Admin panel (platform
 * admins only) and Sign out.
 */
export function ProfileMenu() {
  const t = useTranslations("Sidebar");
  const tShell = useTranslations("Shell");
  const { user, profile, signOut } = useAuth();
  const name = profile?.full_name ?? user?.name ?? t("defaultUser");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tShell("profile.menu")}
        className="flex size-12 items-center justify-center rounded-full transition-colors hover:bg-muted data-popup-open:bg-muted"
      >
        <PersonAvatar name={name} src={profile?.avatar_url} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <PersonAvatar name={name} src={profile?.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
          </div>
        </div>
        <div className="px-2 pb-2">
          <WorkspaceLine />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings?tab=profile" />}>
          <User className="size-4" aria-hidden />
          {t("menuProfile")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" aria-hidden />
          {t("menuSettings")}
        </DropdownMenuItem>
        {user?.platform_admin ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck className="size-4" aria-hidden />
            {t("adminPanel")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4" aria-hidden />
          {t("menuSignOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
