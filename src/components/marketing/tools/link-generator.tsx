'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import {
  isValidPhone,
  normalizePhone,
  waLink,
} from '@/lib/marketing/whatsapp-tools';
import { QrCanvas, type QrCanvasHandle } from './qr-canvas';
import {
  CopyButton,
  downloadUrl,
  Field,
  inputClass,
  PhoneInput,
  ToolPanel,
} from './ui';

export function LinkGenerator() {
  const [dial, setDial] = useState('91');
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const qr = useRef<QrCanvasHandle>(null);

  const phone = normalizePhone(dial, number);
  const valid = isValidPhone(phone);
  const link = useMemo(
    () => (valid ? waLink(phone, message) : ''),
    [valid, phone, message]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <ToolPanel>
        <h2 className="text-xl font-bold">Your details</h2>
        <div className="mt-5 space-y-5">
          <PhoneInput
            idPrefix="lg"
            dial={dial}
            number={number}
            onDial={setDial}
            onNumber={setNumber}
            invalid={number.trim() !== '' && !valid}
          />
          <Field
            label="Pre-filled message (optional)"
            htmlFor="lg-message"
            hint="Customers see this typed in for them; they can edit it before sending."
          >
            <textarea
              id="lg-message"
              rows={4}
              maxLength={1000}
              placeholder="Hi! I'd like to know more about your products."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </ToolPanel>

      <ToolPanel className="bg-mk-bg-alt2">
        <h2 className="text-xl font-bold">Your WhatsApp link</h2>
        {link ? (
          <>
            <div className="border-mk-border mt-5 rounded-xl border bg-white p-3.5 font-mono text-sm break-all">
              {link}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" />
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="border-mk-soft2 text-mk-heading hover:border-mk-primary inline-flex h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold"
              >
                <ExternalLink aria-hidden className="h-4 w-4" /> Test link
              </a>
            </div>
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-white p-5">
              <QrCanvas
                ref={qr}
                value={link}
                size={220}
                label="QR code for your WhatsApp link"
              />
              <button
                type="button"
                onClick={() => {
                  const url = qr.current?.toPng();
                  if (url) downloadUrl(url, 'whatsapp-qr.png');
                }}
                className="text-mk-primary-hover inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <Download aria-hidden className="h-4 w-4" /> Download QR code
              </button>
            </div>
          </>
        ) : (
          <p className="text-mk-body mt-5 text-sm">
            Enter your WhatsApp number to generate a link you can share on
            your website, Instagram bio, emails or ads.
          </p>
        )}
      </ToolPanel>
    </div>
  );
}
