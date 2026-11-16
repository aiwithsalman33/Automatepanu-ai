'use client';

import { useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ImagePlus, X } from 'lucide-react';
import {
  isValidPhone,
  normalizePhone,
  waLink,
} from '@/lib/marketing/whatsapp-tools';
import { cn } from '@/lib/utils';
import { QrCanvas, type QrCanvasHandle } from './qr-canvas';
import {
  downloadUrl,
  Field,
  inputClass,
  PhoneInput,
  ToolPanel,
} from './ui';

type Mode = 'chat' | 'url';
const MAX_LOGO_BYTES = 1024 * 1024;

export function QrGenerator() {
  const [mode, setMode] = useState<Mode>('chat');
  const [dial, setDial] = useState('91');
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [dark, setDark] = useState('#111827');
  const [light, setLight] = useState('#ffffff');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const qr = useRef<QrCanvasHandle>(null);

  const phone = normalizePhone(dial, number);
  const validPhone = isValidPhone(phone);
  const value =
    mode === 'chat'
      ? validPhone
        ? waLink(phone, message)
        : ''
      : url.trim();

  const onLogo = (file: File | undefined) => {
    setLogoError('');
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError('Use a PNG, JPG, WebP or SVG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo must be under 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  const downloadSvg = async () => {
    if (!value) return;
    const svg = await QRCode.toString(value, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark, light },
    });
    const blobUrl = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml' })
    );
    downloadUrl(blobUrl, 'whatsapp-qr.svg');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <ToolPanel>
        <div
          role="tablist"
          aria-label="QR code type"
          className="bg-mk-bg-alt2 inline-flex rounded-full p-1"
        >
          {(
            [
              ['chat', 'WhatsApp chat'],
              ['url', 'Any link or text'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold',
                mode === id
                  ? 'text-mk-primary-hover bg-white shadow-sm'
                  : 'text-mk-body'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {mode === 'chat' ? (
            <>
              <PhoneInput
                idPrefix="qr"
                dial={dial}
                number={number}
                onDial={setDial}
                onNumber={setNumber}
                invalid={number.trim() !== '' && !validPhone}
              />
              <Field label="Pre-filled message (optional)" htmlFor="qr-msg">
                <textarea
                  id="qr-msg"
                  rows={3}
                  maxLength={500}
                  placeholder="Hi! I scanned your QR code."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <Field label="Link or text" htmlFor="qr-url">
              <input
                id="qr-url"
                type="text"
                maxLength={1500}
                placeholder="https://your-website.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="QR colour" htmlFor="qr-dark">
              <input
                id="qr-dark"
                type="color"
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                className="border-mk-border h-11 w-full cursor-pointer rounded-xl border bg-white p-1"
              />
            </Field>
            <Field label="Background" htmlFor="qr-light">
              <input
                id="qr-light"
                type="color"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                className="border-mk-border h-11 w-full cursor-pointer rounded-xl border bg-white p-1"
              />
            </Field>
          </div>

          <Field
            label="Logo in the centre (optional)"
            htmlFor="qr-logo"
            hint={logoError || 'PNG, JPG, WebP or SVG, up to 1 MB. Stays in your browser.'}
          >
            <div className="flex items-center gap-3">
              <label
                htmlFor="qr-logo"
                className="border-mk-soft2 text-mk-heading hover:border-mk-primary inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold"
              >
                <ImagePlus aria-hidden className="h-4 w-4" />
                {logo ? 'Change logo' : 'Upload logo'}
              </label>
              <input
                id="qr-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="text-mk-muted hover:text-mk-heading inline-flex items-center gap-1 text-sm"
                >
                  <X aria-hidden className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
          </Field>
        </div>
      </ToolPanel>

      <ToolPanel className="bg-mk-bg-alt2 flex flex-col items-center">
        <h2 className="self-start text-xl font-bold">Your QR code</h2>
        {value ? (
          <>
            <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
              <QrCanvas
                ref={qr}
                value={value}
                size={300}
                dark={dark}
                light={light}
                logo={logo}
                label="Generated QR code"
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const png = qr.current?.toPng();
                  if (png) downloadUrl(png, 'whatsapp-qr.png');
                }}
                className="bg-mk-primary hover:bg-mk-primary-hover inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
              >
                <Download aria-hidden className="h-4 w-4" /> Download PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="border-mk-soft2 text-mk-heading hover:border-mk-primary inline-flex h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold"
              >
                <Download aria-hidden className="h-4 w-4" /> SVG
                {logo ? ' (no logo)' : ''}
              </button>
            </div>
            <p className="text-mk-muted mt-3 text-center text-xs">
              Test the code with your phone camera before printing it.
            </p>
          </>
        ) : (
          <p className="text-mk-body mt-5 self-start text-sm">
            {mode === 'chat'
              ? 'Enter your WhatsApp number to create a QR code that opens a chat with you.'
              : 'Enter a link or any text to turn it into a QR code.'}
          </p>
        )}
      </ToolPanel>
    </div>
  );
}
