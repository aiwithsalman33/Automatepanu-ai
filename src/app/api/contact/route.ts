// ============================================================
// POST /api/contact — website contact / demo-request form.
//
// Public (no session). Emails the message to CONTACT_EMAIL (falls back
// to PLATFORM_ADMIN_EMAIL) through the app's SMTP. Protected by a
// same-origin check, a honeypot field and a per-IP rate limit.
// ============================================================
import { NextResponse } from 'next/server';
import { mailer } from '@/lib/email/mailer';
import { escapeHtml } from '@/lib/email/templates';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateContact } from '@/lib/marketing/contact';

export const runtime = 'nodejs';

function recipient(): string | null {
  const to =
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.PLATFORM_ADMIN_EMAIL?.trim() ||
    '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const limit = checkRateLimit(`contact:${getClientIp(request)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const result = validateContact(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // Honeypot filled → a bot. Pretend success, send nothing.
  if (result.spam) return NextResponse.json({ ok: true });

  const to = recipient();
  if (!to) {
    console.error('[contact] CONTACT_EMAIL / PLATFORM_ADMIN_EMAIL not set');
    return NextResponse.json(
      { error: 'The contact form is not available right now.' },
      { status: 503 }
    );
  }

  const m = result.value;
  const rows: [string, string][] = [
    ['Topic', m.topic === 'demo' ? 'Demo request' : 'General enquiry'],
    ['Name', m.name],
    ['Email', m.email],
    ['Company', m.company || '-'],
    ['Phone', m.phone || '-'],
  ];
  const subject = `[Website] ${m.topic === 'demo' ? 'Demo request' : 'Enquiry'} from ${m.name}`;
  try {
    await mailer().send({
      to,
      subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${m.message}\n\nReply directly to ${m.email}.`,
      html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<table cellpadding="4">${rows
        .map(
          ([k, v]) =>
            `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`
        )
        .join('')}</table>
<p style="white-space:pre-wrap">${escapeHtml(m.message)}</p>
<p style="color:#666">Reply directly to ${escapeHtml(m.email)}.</p>
</body></html>`,
    });
  } catch (err) {
    console.error('[contact] send failed', err);
    return NextResponse.json(
      { error: 'Could not send your message. Please try again.' },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
