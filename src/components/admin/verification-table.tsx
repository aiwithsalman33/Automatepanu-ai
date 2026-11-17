'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Mail } from 'lucide-react';

import { resendVerification, verifyUsers, type ActionResult } from '@/app/admin/actions';
import { StatusPill, UserAvatar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { fmtDateTime, fmtRelative } from '@/lib/admin/format';

export interface VerificationRow {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  disabled: boolean;
  created_at: string;
  account_name: string | null;
}

export function VerificationTable({ rows }: { rows: VerificationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectable = rows.filter((r) => !r.email_verified && !r.disabled);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const run = (id: string | null, fn: () => Promise<ActionResult>) => {
    setBusyId(id);
    start(async () => {
      const res = await fn();
      setBusyId(null);
      if (res.ok) {
        toast.success(res.message);
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div>
      {selectable.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && selected.size > 0}
              onCheckedChange={(v) => setSelected(v === true ? new Set(selectable.map((r) => r.id)) : new Set())}
              aria-label="Select all pending users on this page"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all pending'}
          </label>
          <Button size="sm" disabled={pending || selected.size === 0} onClick={() => run(null, () => verifyUsers([...selected]))}>
            <BadgeCheck /> Verify selected
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5"><span className="sr-only">Select</span></th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Signed up</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Workspace</th>
              <th className="px-4 py-2.5 text-right font-medium">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const canVerify = !r.email_verified && !r.disabled;
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {canVerify ? (
                      <Checkbox
                        className="flex"
                        checked={selected.has(r.id)}
                        onCheckedChange={(v) => toggle(r.id, v === true)}
                        aria-label={`Select ${r.email}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={r.name} email={r.email} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/admin/users/${r.id}`} className="block truncate font-medium text-foreground hover:underline">
                          {r.name || r.email}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusPill verified={r.email_verified} disabled={r.disabled} /></td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell" title={fmtDateTime(r.created_at)}>
                    {fmtRelative(r.created_at)}
                  </td>
                  <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground lg:table-cell">{r.account_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canVerify ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => run(r.id, () => resendVerification(r.id))}
                            title="Send the verification email again"
                          >
                            <Mail /> <span className="hidden sm:inline">Resend</span>
                          </Button>
                          <Button size="sm" disabled={pending} onClick={() => run(r.id, () => verifyUsers([r.id]))}>
                            <BadgeCheck /> {busyId === r.id ? 'Working…' : 'Give access'}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.disabled ? 'Disabled' : 'Has access'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
