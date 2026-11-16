import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMailer, MailerNotConfiguredError } from './mailer';
import {
  changeEmailMessage,
  escapeHtml,
  resetPasswordMessage,
  verifyEmailMessage,
} from './templates';

const msg = verifyEmailMessage(
  'a@x.test',
  'https://app.test/api/auth/verify-email?token=t'
);

afterEach(() => vi.restoreAllMocks());

describe('createMailer without SMTP', () => {
  it('logs instead of sending in development', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await createMailer({ NODE_ENV: 'development' } as NodeJS.ProcessEnv).send(
      msg
    );
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0][0])).toContain('verify-email?token=t');
  });

  it('refuses to silently drop email in production', async () => {
    await expect(
      createMailer({ NODE_ENV: 'production' } as NodeJS.ProcessEnv).send(msg)
    ).rejects.toBeInstanceOf(MailerNotConfiguredError);
  });
});

describe('templates', () => {
  it('escapes HTML in user-controlled values', () => {
    expect(escapeHtml(`<img src=x onerror="a">'&`)).toBe(
      '&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;'
    );
    const m = verifyEmailMessage(
      'a@x.test',
      'https://app.test/v',
      '<script>x</script>'
    );
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });

  it('every template carries its link in both text and HTML', () => {
    const url = 'https://app.test/link?token=abc';
    for (const m of [
      verifyEmailMessage('a@x.test', url, 'Ada'),
      resetPasswordMessage('a@x.test', url, 'Ada'),
      changeEmailMessage('a@x.test', url, 'new@x.test'),
    ]) {
      expect(m.to).toBe('a@x.test');
      expect(m.text).toContain(url);
      expect(m.html).toContain(escapeHtml(url));
    }
  });

  it('change-email confirmation names the new address', () => {
    const m = changeEmailMessage(
      'old@x.test',
      'https://app.test/c',
      'new@x.test'
    );
    expect(m.text).toContain('new@x.test');
    expect(m.html).toContain('new@x.test');
  });
});
