/** Validation for the website contact form (/api/contact). */

export interface ContactMessage {
  topic: 'general' | 'demo';
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
}

export type ContactResult =
  | { ok: true; spam: boolean; value: ContactMessage }
  | { ok: false; error: string };

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Single line: no control characters (keeps headers/subjects clean). */
const line = (v: unknown, max: number) =>
  str(v, max).replace(/[\u0000-\u001f\u007f]+/g, ' ');

export function validateContact(input: unknown): ContactResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid request' };
  }
  const o = input as Record<string, unknown>;
  const value: ContactMessage = {
    topic: o.topic === 'demo' ? 'demo' : 'general',
    name: line(o.name, 100),
    email: line(o.email, 200).toLowerCase(),
    company: line(o.company, 120),
    phone: line(o.phone, 30),
    message: str(o.message, 5000),
  };
  if (value.name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (value.phone && !/^[+\d][\d\s()-]{5,}$/.test(value.phone)) {
    return { ok: false, error: 'Please enter a valid phone number.' };
  }
  if (value.message.length < 10) {
    return { ok: false, error: 'Please write a short message (10+ characters).' };
  }
  // Honeypot: a field humans never see.
  const spam = typeof o.website === 'string' && o.website.trim() !== '';
  return { ok: true, spam, value };
}
