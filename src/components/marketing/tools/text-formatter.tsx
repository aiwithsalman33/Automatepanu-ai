'use client';

import { useRef, useState } from 'react';
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react';
import { whatsappToHtml } from '@/lib/marketing/whatsapp-tools';
import { CopyButton, inputClass, ToolPanel } from './ui';

type Action =
  | { kind: 'wrap'; marker: string }
  | { kind: 'line'; prefix: string | ((i: number) => string) };

const ACTIONS: { label: string; icon: LucideIcon; action: Action }[] = [
  { label: 'Bold', icon: Bold, action: { kind: 'wrap', marker: '*' } },
  { label: 'Italic', icon: Italic, action: { kind: 'wrap', marker: '_' } },
  {
    label: 'Strikethrough',
    icon: Strikethrough,
    action: { kind: 'wrap', marker: '~' },
  },
  {
    label: 'Monospace',
    icon: SquareCode,
    action: { kind: 'wrap', marker: '```' },
  },
  { label: 'Inline code', icon: Code, action: { kind: 'wrap', marker: '`' } },
  { label: 'Bulleted list', icon: List, action: { kind: 'line', prefix: '- ' } },
  {
    label: 'Numbered list',
    icon: ListOrdered,
    action: { kind: 'line', prefix: (i) => `${i + 1}. ` },
  },
  { label: 'Quote', icon: Quote, action: { kind: 'line', prefix: '> ' } },
];

const SAMPLE = `*Diwali offer* 🎉
Get _20% off_ on all orders this week.

- Free delivery above ₹999
- Easy 7-day returns

~Was ₹1,499~ now *₹1,199*
Use code \`DIWALI20\` at checkout.`;

export function TextFormatter() {
  const [text, setText] = useState(SAMPLE);
  const ta = useRef<HTMLTextAreaElement>(null);

  const apply = (action: Action) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let next: string;
    let selS: number;
    let selE: number;
    if (action.kind === 'wrap') {
      const m = action.marker;
      const picked = value.slice(s, e) || 'text';
      // Markers must hug the text: keep surrounding spaces outside.
      const lead = picked.match(/^\s*/)?.[0] ?? '';
      const trail = picked.match(/\s*$/)?.[0] ?? '';
      const core = picked.trim() || 'text';
      next =
        value.slice(0, s) + lead + m + core + m + trail + value.slice(e);
      selS = s + lead.length + m.length;
      selE = selS + core.length;
    } else {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const lineEnd = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e);
      const block = value.slice(lineStart, lineEnd).split('\n');
      const prefixed = block
        .map((l, i) =>
          typeof action.prefix === 'string'
            ? action.prefix + l
            : action.prefix(i) + l
        )
        .join('\n');
      next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
      selS = lineStart;
      selE = lineStart + prefixed.length;
    }
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selS, selE);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ToolPanel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Write your message</h2>
          <button
            type="button"
            onClick={() => setText('')}
            className="text-mk-muted hover:text-mk-heading text-sm"
          >
            Clear
          </button>
        </div>
        <div
          role="toolbar"
          aria-label="Formatting"
          className="border-mk-border mt-4 flex flex-wrap gap-1 rounded-xl border bg-white p-1.5"
        >
          {ACTIONS.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => apply(action)}
              className="text-mk-heading hover:bg-mk-soft hover:text-mk-primary-hover inline-flex h-9 w-9 items-center justify-center rounded-lg"
            >
              <Icon aria-hidden className="h-4 w-4" />
            </button>
          ))}
        </div>
        <label htmlFor="tf-text" className="sr-only">
          Message text
        </label>
        <textarea
          id="tf-text"
          ref={ta}
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} mt-3 font-mono leading-6`}
        />
        <div className="text-mk-muted mt-2 flex justify-between text-xs">
          <span>Select text, then pick a style.</span>
          <span>{text.length} characters</span>
        </div>
        <div className="mt-4">
          <CopyButton value={text} label="Copy formatted text" disabled={!text} />
        </div>
      </ToolPanel>

      <ToolPanel className="bg-[#efeae2]">
        <h2 className="text-xl font-bold">Preview</h2>
        <p className="text-mk-body text-sm">How it will look in WhatsApp.</p>
        <div className="mt-5 flex justify-end">
          <div
            className="wa-preview relative max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-2.5 text-[15px] leading-6 break-words text-[#111b21] shadow-sm"
            // Escaped first, then formatted: see whatsappToHtml (tested).
            dangerouslySetInnerHTML={{
              __html: text
                ? whatsappToHtml(text)
                : '<span style="opacity:.5">Your message preview</span>',
            }}
          />
        </div>
        <style>{`
          .wa-preview .wa-code,.wa-preview .wa-mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;background:rgba(0,0,0,.06);border-radius:4px;padding:1px 4px}
          .wa-preview .wa-quote{display:inline-block;border-left:3px solid rgba(0,0,0,.25);padding-left:8px;color:#3b4a54}
        `}</style>
      </ToolPanel>
    </div>
  );
}
