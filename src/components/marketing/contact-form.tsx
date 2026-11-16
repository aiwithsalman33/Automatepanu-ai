'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field, inputClass } from './tools/ui';

type Topic = 'general' | 'demo';

export function ContactForm({ initialTopic }: { initialTopic: Topic }) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setState('sending');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, topic }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Something went wrong.');
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div className="border-mk-border shadow-mk rounded-3xl border bg-white p-8 text-center">
        <CheckCircle2 aria-hidden className="text-mk-primary mx-auto h-12 w-12" />
        <h2 className="mt-4 text-2xl font-bold">Thanks, message sent!</h2>
        <p className="text-mk-body mt-2">
          We’ll reply to your email as soon as we can, usually within one
          business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-mk-border shadow-mk space-y-5 rounded-3xl border bg-white p-6 sm:p-8"
      noValidate={false}
    >
      <div
        role="radiogroup"
        aria-label="What can we help with?"
        className="bg-mk-bg-alt2 grid grid-cols-2 rounded-full p-1"
      >
        {(
          [
            ['demo', 'Book a demo'],
            ['general', 'General question'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={topic === id}
            onClick={() => setTopic(id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold',
              topic === id
                ? 'text-mk-primary-hover bg-white shadow-sm'
                : 'text-mk-body'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name">
          <input id="c-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Work email" htmlFor="c-email">
          <input id="c-email" name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Company (optional)" htmlFor="c-company">
          <input id="c-company" name="company" maxLength={120} autoComplete="organization" className={inputClass} />
        </Field>
        <Field label="Phone / WhatsApp (optional)" htmlFor="c-phone">
          <input id="c-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" className={inputClass} />
        </Field>
      </div>
      <Field
        label={topic === 'demo' ? 'What would you like to see?' : 'Your message'}
        htmlFor="c-message"
      >
        <textarea
          id="c-message"
          name="message"
          rows={5}
          required
          minLength={10}
          maxLength={5000}
          placeholder={
            topic === 'demo'
              ? 'Team size, how you use WhatsApp today, what you want to automate…'
              : 'How can we help?'
          }
          className={inputClass}
        />
      </Field>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="bg-mk-primary hover:bg-mk-primary-hover inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white disabled:opacity-60"
      >
        {state === 'sending' && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
        {topic === 'demo' ? 'Request a demo' : 'Send message'}
      </button>
      <p className="text-mk-muted text-center text-xs">
        We only use your details to reply to you. See our{' '}
        <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}
