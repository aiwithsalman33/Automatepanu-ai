import { describe, expect, it } from 'vitest';
import {
  isValidPhone,
  normalizePhone,
  waLink,
  whatsappToHtml,
  widgetSnippet,
} from './whatsapp-tools';

describe('normalizePhone', () => {
  it.each([
    ['91', '98765 43210', '919876543210'],
    ['91', '098765-43210', '919876543210'],
    ['91', '+44 20 7946 0958', '442079460958'],
    ['91', '0044 20 7946 0958', '442079460958'],
    ['91', '919876543210', '919876543210'],
    ['1', '(415) 555-0100', '14155550100'],
    ['91', '   ', ''],
  ])('%s + %s → %s', (dial, input, want) => {
    expect(normalizePhone(dial, input)).toBe(want);
  });
});

describe('isValidPhone', () => {
  it('accepts 8-15 digits only', () => {
    expect(isValidPhone('919876543210')).toBe(true);
    expect(isValidPhone('1234567')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
    expect(isValidPhone('91a876543210')).toBe(false);
  });
});

describe('waLink', () => {
  it('omits ?text when the message is empty', () => {
    expect(waLink('919876543210')).toBe('https://wa.me/919876543210');
    expect(waLink('919876543210', '   ')).toBe('https://wa.me/919876543210');
  });
  it('encodes the message', () => {
    expect(waLink('919876543210', 'Hi & hello? 50%')).toBe(
      'https://wa.me/919876543210?text=Hi%20%26%20hello%3F%2050%25'
    );
  });
});

describe('whatsappToHtml', () => {
  it('formats bold, italic, strike, code and monospace', () => {
    expect(whatsappToHtml('*bold* _it_ ~gone~ `x` ```m *n*```')).toBe(
      '<strong>bold</strong> <em>it</em> <s>gone</s> <code class="wa-code">x</code> <code class="wa-mono">m *n*</code>'
    );
  });
  it('needs markers to hug text (like WhatsApp)', () => {
    expect(whatsappToHtml('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(whatsappToHtml('snake_case_name')).toBe('snake_case_name');
  });
  it('renders lists and quotes per line', () => {
    expect(whatsappToHtml('- a\n2. b\n> c')).toBe(
      '<span class="wa-li">• a</span><br><span class="wa-li">2. b</span><br><span class="wa-quote">c</span>'
    );
  });
  it('escapes HTML', () => {
    expect(whatsappToHtml('<img src=x onerror=alert(1)> *<b>*')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; <strong>&lt;b&gt;</strong>'
    );
  });
});

describe('widgetSnippet', () => {
  const base = {
    phone: '919876543210',
    message: 'Hello',
    buttonText: 'Chat',
    greeting: 'Hi there',
    brandName: 'Shop',
    color: '#25D366',
    position: 'right' as const,
  };
  it('embeds the config as JS string literals', () => {
    const s = widgetSnippet(base);
    expect(s).toContain('phone:"919876543210"');
    expect(s).toContain('side:"right"');
    expect(s.startsWith('<!-- WhatsApp chat button')).toBe(true);
  });
  it('cannot break out of the script tag', () => {
    const s = widgetSnippet({
      ...base,
      greeting: '</script><script>alert(1)</script>',
      brandName: '"};alert(1);//',
    });
    expect(s.match(/<\/script>/g)?.length).toBe(1);
    expect(s).toContain('\\u003c/script\\u003e');
    expect(s).toContain('name:"\\"};alert(1);//"');
  });
  it('falls back to WhatsApp green for an invalid colour', () => {
    expect(widgetSnippet({ ...base, color: 'red;}' })).toContain(
      'color:"#25D366"'
    );
  });
});
