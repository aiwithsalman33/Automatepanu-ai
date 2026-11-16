/**
 * Pure helpers behind the free WhatsApp tools on the website
 * (/tools/*). Everything runs in the visitor's browser; nothing is sent
 * to a server.
 */

export interface CountryCode {
  iso: string;
  name: string;
  dial: string;
}

/** Common dialling codes first (India default), then alphabetical. */
export const COUNTRY_CODES: CountryCode[] = [
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971' },
  { iso: 'US', name: 'United States / Canada', dial: '1' },
  { iso: 'GB', name: 'United Kingdom', dial: '44' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'BH', name: 'Bahrain', dial: '973' },
  { iso: 'BR', name: 'Brazil', dial: '55' },
  { iso: 'DE', name: 'Germany', dial: '49' },
  { iso: 'EG', name: 'Egypt', dial: '20' },
  { iso: 'ES', name: 'Spain', dial: '34' },
  { iso: 'FR', name: 'France', dial: '33' },
  { iso: 'ID', name: 'Indonesia', dial: '62' },
  { iso: 'IT', name: 'Italy', dial: '39' },
  { iso: 'KE', name: 'Kenya', dial: '254' },
  { iso: 'KR', name: 'South Korea', dial: '82' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'MX', name: 'Mexico', dial: '52' },
  { iso: 'NG', name: 'Nigeria', dial: '234' },
  { iso: 'NL', name: 'Netherlands', dial: '31' },
  { iso: 'NP', name: 'Nepal', dial: '977' },
  { iso: 'NZ', name: 'New Zealand', dial: '64' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'PH', name: 'Philippines', dial: '63' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'TH', name: 'Thailand', dial: '66' },
  { iso: 'TR', name: 'Türkiye', dial: '90' },
  { iso: 'ZA', name: 'South Africa', dial: '27' },
];

/**
 * International number as digits only (what wa.me expects): no "+",
 * spaces, dashes or the local trunk "0". A number already typed with its
 * country code (e.g. "+91 98…" or "0091 98…") is kept as is.
 */
export function normalizePhone(dial: string, input: string): string {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  const local = digits.replace(/^0+/, '');
  if (dial && local.startsWith(dial) && local.length > dial.length + 8) {
    return local; // already includes the country code
  }
  return `${dial}${local}`;
}

/** A plausible international number: 8–15 digits (E.164 max is 15). */
export function isValidPhone(digits: string): boolean {
  return /^\d{8,15}$/.test(digits);
}

/** Click-to-chat link. Empty message → no ?text. */
export function waLink(phoneDigits: string, message = ''): string {
  const base = `https://wa.me/${phoneDigits}`;
  const text = message.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline WhatsApp markup → HTML (input already escaped). */
function inline(escaped: string): string {
  const code: string[] = [];
  // Protect monospace/code spans so their content isn't formatted.
  let s = escaped.replace(/```([\s\S]+?)```/g, (_, c: string) => {
    code.push(`<code class="wa-mono">${c}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });
  s = s.replace(/`([^`\n]+)`/g, (_, c: string) => {
    code.push(`<code class="wa-code">${c}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });
  // A marker must hug non-space text on both sides, like WhatsApp.
  const wrap = (re: RegExp, tag: string) => {
    s = s.replace(re, `$1<${tag}>$2</${tag}>`);
  };
  wrap(/(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])/g, 'strong');
  wrap(/(^|[^\w_])_(\S(?:[^_\n]*?\S)?)_(?![\w_])/g, 'em');
  wrap(/(^|[^\w~])~(\S(?:[^~\n]*?\S)?)~(?![\w~])/g, 's');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => code[Number(i)]);
}

/**
 * Render WhatsApp-formatted text as safe HTML for a preview bubble:
 * *bold*, _italic_, ~strike~, ```monospace```, `inline code`,
 * "- " / "* " bullets, "1. " numbered lists and "> " quotes.
 */
export function whatsappToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const esc = escapeHtml(line);
    let m: RegExpMatchArray | null;
    if ((m = esc.match(/^&gt; ?(.*)$/))) {
      out.push(`<span class="wa-quote">${inline(m[1])}</span>`);
    } else if ((m = esc.match(/^[-*] (.*)$/))) {
      out.push(`<span class="wa-li">• ${inline(m[1])}</span>`);
    } else if ((m = esc.match(/^(\d+)\. (.*)$/))) {
      out.push(`<span class="wa-li">${m[1]}. ${inline(m[2])}</span>`);
    } else {
      out.push(inline(esc));
    }
  }
  return out.join('<br>');
}

export type WidgetPosition = 'right' | 'left';

export interface WidgetOptions {
  phone: string;
  message: string;
  buttonText: string;
  greeting: string;
  brandName: string;
  color: string;
  position: WidgetPosition;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A string literal that is safe inside <script> (no "</script>"). */
function jsString(v: string): string {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
}

/**
 * Self-contained embed snippet: a floating WhatsApp button with a small
 * greeting card. No external requests, no cookies. Every user value is
 * passed as a JS string literal and set with textContent, so it can't
 * inject markup.
 */
export function widgetSnippet(o: WidgetOptions): string {
  const color = HEX.test(o.color) ? o.color : '#25D366';
  const side = o.position === 'left' ? 'left' : 'right';
  const cfg = `{phone:${jsString(o.phone)},text:${jsString(o.message.trim())},label:${jsString(o.buttonText.trim() || 'Chat with us')},greeting:${jsString(o.greeting.trim())},name:${jsString(o.brandName.trim())},color:${jsString(color)},side:${jsString(side)}}`;
  return `<!-- WhatsApp chat button (Automate) -->
<script>
(function () {
  var c = ${cfg};
  if (!c.phone) return;
  var link = "https://wa.me/" + c.phone + (c.text ? "?text=" + encodeURIComponent(c.text) : "");
  var root = document.createElement("div");
  root.style.cssText = "position:fixed;bottom:20px;" + c.side + ":20px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  var card = document.createElement("div");
  card.style.cssText = "display:none;width:280px;margin-bottom:12px;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden";
  var head = document.createElement("div");
  head.style.cssText = "background:" + c.color + ";color:#fff;padding:14px 16px;font-weight:600;font-size:15px";
  head.textContent = c.name || "WhatsApp";
  var body = document.createElement("div");
  body.style.cssText = "padding:16px;font-size:14px;color:#111;line-height:1.45";
  body.textContent = c.greeting || "Hi! How can we help you?";
  var go = document.createElement("a");
  go.href = link; go.target = "_blank"; go.rel = "noopener";
  go.style.cssText = "display:block;margin:0 16px 16px;padding:10px;border-radius:999px;background:" + c.color + ";color:#fff;text-align:center;text-decoration:none;font-weight:600;font-size:14px";
  go.textContent = "Start chat";
  card.appendChild(head); card.appendChild(body); card.appendChild(go);
  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", c.label);
  btn.style.cssText = "display:flex;align-items:center;gap:8px;margin-left:auto;border:0;cursor:pointer;padding:12px 18px;border-radius:999px;background:" + c.color + ";color:#fff;font-weight:600;font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.2)";
  btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg>';
  var span = document.createElement("span"); span.textContent = c.label; btn.appendChild(span);
  btn.onclick = function () { card.style.display = card.style.display === "none" ? "block" : "none"; };
  root.appendChild(card); root.appendChild(btn);
  (document.body || document.documentElement).appendChild(root);
})();
</script>`;
}
