'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Ban,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
} from 'lucide-react';

import {
  deleteUser,
  resendVerification,
  revokeUserSessions,
  setPlatformAdmin,
  setUserDisabled,
  setUserPassword,
  verifyUsers,
  type ActionResult,
} from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DeletePlan } from '@/lib/admin/queries';

export interface ActionTarget {
  id: string;
  email: string;
  verified: boolean;
  disabled: boolean;
  platformAdmin: boolean;
  isSelf: boolean;
  activeSessions: number;
  deletePlan: DeletePlan;
  createdRows: Record<string, number>;
}

/** Run an action, toast the outcome, refresh server data. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message);
        onOk?.();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  return { pending, run };
}

/** 16 chars from an unambiguous alphabet, via the browser's CSPRNG. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DialogKey = 'password' | 'disable' | 'admin' | 'sessions' | 'delete' | null;

export function UserActions({ target }: { target: ActionTarget }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState<DialogKey>(null);
  const close = () => setOpen(null);

  // Password dialog state
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [signOut, setSignOut] = useState(true);
  // Delete dialog state
  const [confirmEmail, setConfirmEmail] = useState('');

  const openPassword = () => {
    setPassword(generatePassword());
    setShow(true);
    setSignOut(!target.isSelf);
    setOpen('password');
  };

  const blocked = target.deletePlan.blockedBy.length > 0;
  const created = Object.entries(target.createdRows).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-2">
      {!target.verified ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => run(() => verifyUsers([target.id]))} disabled={pending}>
            <BadgeCheck /> Verify &amp; give access
          </Button>
          <Button variant="outline" onClick={() => run(() => resendVerification(target.id))} disabled={pending}>
            <Mail /> Resend email
          </Button>
        </div>
      ) : null}

      <ActionRow icon={KeyRound} label="Set a new password" hint="No current password needed" onClick={openPassword} disabled={pending} />
      {!target.isSelf ? (
        <>
          <ActionRow
            icon={LogOut}
            label="Sign out everywhere"
            hint={`${target.activeSessions} active session${target.activeSessions === 1 ? '' : 's'}`}
            onClick={() => setOpen('sessions')}
            disabled={pending || target.activeSessions === 0}
          />
          <ActionRow
            icon={target.platformAdmin ? ShieldOff : ShieldCheck}
            label={target.platformAdmin ? 'Remove admin access' : 'Make platform admin'}
            hint={target.platformAdmin ? 'Loses access to this console' : 'Full access to this console'}
            onClick={() => setOpen('admin')}
            disabled={pending}
          />
          <ActionRow
            icon={target.disabled ? UserCheck : Ban}
            label={target.disabled ? 'Enable user' : 'Disable user'}
            hint={target.disabled ? 'Allow sign-in again' : 'Block sign-in, end sessions'}
            onClick={() => setOpen('disable')}
            disabled={pending}
            tone={target.disabled ? undefined : 'warning'}
          />
          <ActionRow
            icon={Trash2}
            label="Delete user"
            hint="Permanent"
            onClick={() => {
              setConfirmEmail('');
              setOpen('delete');
            }}
            disabled={pending}
            tone="critical"
          />
        </>
      ) : (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          This is your account. Disabling, deleting and removing admin access are turned off so you can&apos;t lock yourself out.
        </p>
      )}

      {/* Set password */}
      <Confirm
        open={open === 'password'}
        onOpenChange={(v) => (v ? setOpen('password') : close())}
        title="Set a new password"
        description={<>Choose a new password for <strong>{target.email}</strong>. Share it with them securely; they can change it later in Settings.</>}
        confirmLabel="Save password"
        pending={pending}
        confirmDisabled={password.length < 6}
        onConfirm={() => run(() => setUserPassword(target.id, password, signOut), close)}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-new-password">New password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="admin-new-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-9 pr-9 font-mono"
                  minLength={6}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button variant="outline" size="icon-lg" aria-label="Generate password" title="Generate" onClick={() => { setPassword(generatePassword()); setShow(true); }}>
                <RefreshCw />
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Copy password"
                title="Copy"
                onClick={() => navigator.clipboard.writeText(password).then(() => toast.success('Password copied'), () => toast.error('Copy failed'))}
              >
                <Copy />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>
          {!target.isSelf ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={signOut} onCheckedChange={(v) => setSignOut(v === true)} />
              Sign them out of every device
            </label>
          ) : null}
        </div>
      </Confirm>

      {/* Sign out everywhere */}
      <Confirm
        open={open === 'sessions'}
        onOpenChange={(v) => (v ? setOpen('sessions') : close())}
        title="Sign out everywhere?"
        description={<>Ends all {target.activeSessions} active session(s) of <strong>{target.email}</strong>. They can sign in again right away.</>}
        confirmLabel="Sign out everywhere"
        pending={pending}
        onConfirm={() => run(() => revokeUserSessions(target.id), close)}
      />

      {/* Admin access */}
      <Confirm
        open={open === 'admin'}
        onOpenChange={(v) => (v ? setOpen('admin') : close())}
        title={target.platformAdmin ? 'Remove admin access?' : 'Make this user a platform admin?'}
        description={
          target.platformAdmin ? (
            <><strong>{target.email}</strong> will no longer be able to open this admin console.</>
          ) : (
            <><strong>{target.email}</strong> will be able to see every workspace and user, change passwords, and disable or delete accounts.</>
          )
        }
        confirmLabel={target.platformAdmin ? 'Remove access' : 'Make admin'}
        destructive={target.platformAdmin}
        pending={pending}
        onConfirm={() => run(() => setPlatformAdmin(target.id, !target.platformAdmin), close)}
      />

      {/* Disable / enable */}
      <Confirm
        open={open === 'disable'}
        onOpenChange={(v) => (v ? setOpen('disable') : close())}
        title={target.disabled ? 'Enable this user?' : 'Disable this user?'}
        description={
          target.disabled ? (
            <><strong>{target.email}</strong> will be able to sign in again. Their data was kept.</>
          ) : (
            <><strong>{target.email}</strong> is signed out everywhere and can&apos;t sign in until you enable them again. Nothing is deleted.</>
          )
        }
        confirmLabel={target.disabled ? 'Enable user' : 'Disable user'}
        destructive={!target.disabled}
        pending={pending}
        onConfirm={() => run(() => setUserDisabled(target.id, !target.disabled), close)}
      />

      {/* Delete */}
      <Confirm
        open={open === 'delete'}
        onOpenChange={(v) => (v ? setOpen('delete') : close())}
        title="Delete this user permanently?"
        description={blocked ? 'This user can’t be deleted yet.' : 'This can’t be undone.'}
        confirmLabel="Delete user"
        destructive
        pending={pending}
        confirmDisabled={blocked || confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()}
        onConfirm={() =>
          run(() => deleteUser(target.id, confirmEmail), () => {
            close();
            router.push('/admin/users');
          })
        }
      >
        {blocked ? (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-foreground">
            They own{' '}
            {target.deletePlan.blockedBy.map((w, i) => (
              <span key={w.id}>
                {i > 0 ? ', ' : ''}
                <strong>{w.name}</strong> ({w.otherMembers} other member{w.otherMembers === 1 ? '' : 's'})
              </span>
            ))}
            . Deleting them would cut those people off. Remove the other members first, or disable this user instead.
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>The account <strong className="text-foreground">{target.email}</strong> and its sign-in methods</li>
              {target.deletePlan.deletesWorkspaces.map((w) => (
                <li key={w.id}>
                  Workspace <strong className="text-foreground">{w.name}</strong> with all its contacts, chats, broadcasts and settings
                </li>
              ))}
              {created.length > 0 ? (
                <li>
                  Records they created: {created.map(([k, n]) => `${n} ${k}`).join(', ')}
                </li>
              ) : null}
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="admin-confirm-email">Type <span className="font-mono text-foreground">{target.email}</span> to confirm</Label>
              <Input
                id="admin-confirm-email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                autoComplete="off"
                className="h-9"
              />
            </div>
          </div>
        )}
      </Confirm>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  tone,
}: {
  icon: typeof KeyRound;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'warning' | 'critical';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'group flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50 ' +
        (tone === 'critical'
          ? 'hover:border-status-critical/40'
          : tone === 'warning'
            ? 'hover:border-status-warning/40'
            : 'hover:border-primary/30')
      }
    >
      <span
        className={
          'flex size-8 shrink-0 items-center justify-center rounded-md ' +
          (tone === 'critical'
            ? 'bg-status-critical/10 text-status-critical'
            : tone === 'warning'
              ? 'bg-status-warning/12 text-status-warning'
              : 'bg-primary/10 text-primary')
        }
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={'block text-sm font-medium ' + (tone === 'critical' ? 'text-status-critical' : 'text-foreground')}>{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
