'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

import { changeOwnPassword } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, start] = useTransition();
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return;
    start(async () => {
      const res = await changeOwnPassword(current, next);
      if (res.ok) {
        toast.success(res.message);
        setCurrent('');
        setNext('');
        setConfirm('');
      } else toast.error(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-9" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={minLength} maxLength={128} className="h-9" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch || undefined} className="h-9" required />
        </div>
      </div>
      {mismatch ? <p className="text-xs text-status-critical">The new passwords don&apos;t match.</p> : null}
      <Button type="submit" disabled={pending || !current || next.length < minLength || next !== confirm}>
        <KeyRound /> {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
