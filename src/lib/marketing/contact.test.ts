import { describe, expect, it } from 'vitest';
import { validateContact } from './contact';

const good = {
  name: 'Priya',
  email: 'Priya@Example.com',
  message: 'I would like a demo for my team.',
};

describe('validateContact', () => {
  it('accepts a valid message and normalises it', () => {
    const r = validateContact({ ...good, topic: 'demo', company: ' Acme ' });
    expect(r).toEqual({
      ok: true,
      spam: false,
      value: {
        topic: 'demo',
        name: 'Priya',
        email: 'priya@example.com',
        company: 'Acme',
        phone: '',
        message: 'I would like a demo for my team.',
      },
    });
  });
  it('defaults unknown topics to general', () => {
    const r = validateContact({ ...good, topic: 'hack' });
    expect(r.ok && r.value.topic).toBe('general');
  });
  it.each([
    [{ ...good, name: 'P' }, 'name'],
    [{ ...good, email: 'nope' }, 'email'],
    [{ ...good, message: 'hi' }, 'message'],
    [{ ...good, phone: 'call me' }, 'phone'],
  ])('rejects bad input (%#)', (input, word) => {
    const r = validateContact(input);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.toLowerCase()).toContain(word);
  });
  it('strips line breaks from single-line fields (no header injection)', () => {
    const r = validateContact({ ...good, name: 'Eve\r\nBcc: x@y.z' });
    expect(r.ok && r.value.name).toBe('Eve Bcc: x@y.z');
  });
  it('flags the honeypot as spam', () => {
    const r = validateContact({ ...good, website: 'http://spam' });
    expect(r.ok && r.spam).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(validateContact(null).ok).toBe(false);
    expect(validateContact('x').ok).toBe(false);
  });
});
