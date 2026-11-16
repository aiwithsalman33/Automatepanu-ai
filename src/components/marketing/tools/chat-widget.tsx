'use client';

import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  isValidPhone,
  normalizePhone,
  widgetSnippet,
  type WidgetPosition,
} from '@/lib/marketing/whatsapp-tools';
import { cn } from '@/lib/utils';
import {
  CopyButton,
  Field,
  inputClass,
  PhoneInput,
  ToolPanel,
} from './ui';

export function ChatWidget() {
  const [dial, setDial] = useState('91');
  const [number, setNumber] = useState('');
  const [brandName, setBrandName] = useState('Your business');
  const [greeting, setGreeting] = useState('Hi there 👋 How can we help you?');
  const [message, setMessage] = useState('Hi! I have a question.');
  const [buttonText, setButtonText] = useState('Chat with us');
  const [color, setColor] = useState('#25D366');
  const [position, setPosition] = useState<WidgetPosition>('right');
  const [open, setOpen] = useState(true);

  const phone = normalizePhone(dial, number);
  const valid = isValidPhone(phone);
  const snippet = useMemo(
    () =>
      valid
        ? widgetSnippet({
            phone,
            message,
            buttonText,
            greeting,
            brandName,
            color,
            position,
          })
        : '',
    [valid, phone, message, buttonText, greeting, brandName, color, position]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <ToolPanel>
        <h2 className="text-xl font-bold">Customise your button</h2>
        <div className="mt-5 space-y-5">
          <PhoneInput
            idPrefix="cw"
            dial={dial}
            number={number}
            onDial={setDial}
            onNumber={setNumber}
            invalid={number.trim() !== '' && !valid}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="cw-name">
              <input
                id="cw-name"
                maxLength={40}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Button text" htmlFor="cw-btn">
              <input
                id="cw-btn"
                maxLength={30}
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Greeting" htmlFor="cw-greet">
            <textarea
              id="cw-greet"
              rows={2}
              maxLength={160}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Pre-filled message" htmlFor="cw-msg">
            <input
              id="cw-msg"
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Colour" htmlFor="cw-color">
              <input
                id="cw-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="border-mk-border h-11 w-full cursor-pointer rounded-xl border bg-white p-1"
              />
            </Field>
            <Field label="Position" htmlFor="cw-pos">
              <select
                id="cw-pos"
                value={position}
                onChange={(e) => setPosition(e.target.value as WidgetPosition)}
                className={inputClass}
              >
                <option value="right">Bottom right</option>
                <option value="left">Bottom left</option>
              </select>
            </Field>
          </div>
        </div>
      </ToolPanel>

      <div className="min-w-0 space-y-6">
        <ToolPanel className="bg-mk-bg-alt2">
          <h2 className="text-xl font-bold">Live preview</h2>
          <div
            className="border-mk-border relative mt-4 h-80 overflow-hidden rounded-2xl border bg-white"
            aria-label="Widget preview"
          >
            <div className="space-y-2 p-5" aria-hidden>
              <div className="bg-mk-bg-alt2 h-3 w-2/3 rounded" />
              <div className="bg-mk-bg-alt2 h-3 w-1/2 rounded" />
              <div className="bg-mk-bg-alt2 h-3 w-3/5 rounded" />
            </div>
            <div
              className={cn(
                'absolute bottom-4 flex flex-col',
                position === 'left' ? 'left-4 items-start' : 'right-4 items-end'
              )}
            >
              {open && (
                <div className="mb-3 w-60 overflow-hidden rounded-2xl bg-white shadow-xl">
                  <div
                    className="px-4 py-3 text-sm font-semibold text-white"
                    style={{ background: color }}
                  >
                    {brandName || 'WhatsApp'}
                  </div>
                  <p className="px-4 py-3 text-sm text-gray-800">
                    {greeting || 'Hi! How can we help you?'}
                  </p>
                  <span
                    className="mx-4 mb-4 block rounded-full py-2 text-center text-sm font-semibold text-white"
                    style={{ background: color }}
                  >
                    Start chat
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
                style={{ background: color }}
              >
                <MessageCircle aria-hidden className="h-5 w-5" />
                {buttonText || 'Chat with us'}
              </button>
            </div>
          </div>
        </ToolPanel>

        <ToolPanel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Embed code</h2>
            <CopyButton value={snippet} label="Copy code" disabled={!snippet} />
          </div>
          {snippet ? (
            <>
              <pre className="mt-4 max-h-64 max-w-full overflow-auto whitespace-pre rounded-xl bg-[#0f172a] p-4 text-xs leading-5 text-slate-100">
                <code>{snippet}</code>
              </pre>
              <p className="text-mk-muted mt-3 text-xs">
                Paste it just before <code>&lt;/body&gt;</code> on every page
                (or in your site builder’s “custom code” section). No cookies,
                no tracking, no external requests.
              </p>
            </>
          ) : (
            <p className="text-mk-body mt-4 text-sm">
              Enter your WhatsApp number to get the code.
            </p>
          )}
        </ToolPanel>
      </div>
    </div>
  );
}
