'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { COUNTRY_CODES } from '@/lib/marketing/whatsapp-tools';
import { cn } from '@/lib/utils';

export const inputClass =
  'border-mk-border text-mk-heading placeholder:text-mk-muted focus:border-mk-primary focus:ring-mk-soft w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-4';

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-mk-heading mb-1.5 block text-sm font-semibold"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-mk-muted mt-1.5 text-xs">{hint}</p>}
    </div>
  );
}

/** Country code + number, as two inputs side by side. */
export function PhoneInput({
  idPrefix,
  dial,
  number,
  onDial,
  onNumber,
  invalid,
}: {
  idPrefix: string;
  dial: string;
  number: string;
  onDial: (v: string) => void;
  onNumber: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <Field
      label="WhatsApp number"
      htmlFor={`${idPrefix}-number`}
      hint={
        invalid
          ? 'Enter a full phone number (8–15 digits with the country code).'
          : 'The number customers will chat with.'
      }
    >
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={dial}
          onChange={(e) => onDial(e.target.value)}
          className={cn(inputClass, 'w-32 shrink-0 pr-2')}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.iso} value={c.dial}>
              +{c.dial} {c.iso}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-number`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={number}
          onChange={(e) => onNumber(e.target.value)}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, invalid && 'border-red-400')}
        />
      </div>
    </Field>
  );
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
  disabled,
}: {
  value: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Clipboard API blocked (http, old browser): fall back.
          const ta = document.createElement('textarea');
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1800);
      }}
      className={cn(
        'bg-mk-primary hover:bg-mk-primary-hover inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {done ? (
        <Check aria-hidden className="h-4 w-4" />
      ) : (
        <Copy aria-hidden className="h-4 w-4" />
      )}
      {done ? 'Copied' : label}
      <span className="sr-only" aria-live="polite">
        {done ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}

export function ToolPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-mk-border shadow-mk min-w-0 rounded-3xl border bg-white p-5 sm:p-7',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Trigger a file download from a data/blob URL. */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
