'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCode from 'qrcode';

export interface QrCanvasHandle {
  /** PNG data URL of what is drawn (QR + logo). */
  toPng(): string | null;
}

export interface QrCanvasProps {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
  margin?: number;
  /** Data URL of a logo drawn in the centre (error correction goes to H). */
  logo?: string | null;
  className?: string;
  label?: string;
}

/** Draws a QR code on a canvas, optionally with a centred logo. */
export const QrCanvas = forwardRef<QrCanvasHandle, QrCanvasProps>(
  function QrCanvas(
    {
      value,
      size = 320,
      dark = '#111827',
      light = '#ffffff',
      margin = 2,
      logo = null,
      className,
      label = 'QR code',
    },
    ref
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      toPng: () => canvas.current?.toDataURL('image/png') ?? null,
    }));

    useEffect(() => {
      const el = canvas.current;
      if (!el || !value) return;
      let cancelled = false;
      QRCode.toCanvas(el, value, {
        width: size,
        margin,
        errorCorrectionLevel: logo ? 'H' : 'M',
        color: { dark, light },
      })
        .then(() => {
          if (!logo || cancelled) return;
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const ctx = el.getContext('2d');
            if (!ctx) return;
            const box = Math.round(el.width * 0.22);
            const pad = Math.round(box * 0.12);
            const x = (el.width - box) / 2;
            const y = (el.height - box) / 2;
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.roundRect(x - pad, y - pad, box + pad * 2, box + pad * 2, pad * 1.5);
            ctx.fill();
            const ratio = Math.min(box / img.width, box / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            ctx.drawImage(img, (el.width - w) / 2, (el.height - h) / 2, w, h);
          };
          img.src = logo;
        })
        .catch(() => {
          // Value too long for a QR code: leave the canvas as is.
        });
      return () => {
        cancelled = true;
      };
    }, [value, size, dark, light, margin, logo]);

    return (
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        className={className}
        style={{ width: '100%', maxWidth: size, height: 'auto' }}
      />
    );
  }
);
