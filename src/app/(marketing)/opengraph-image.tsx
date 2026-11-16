import { ImageResponse } from 'next/og';
import { brand } from '@/config/brand';

export const alt = `${brand.name} — WhatsApp CRM`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social card for the marketing site (static, built once). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background:
          'linear-gradient(135deg, #ffffff 0%, #f4f0ff 55%, #ede9fe 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 52,
            fontWeight: 800,
          }}
        >
          A
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 44,
            fontWeight: 800,
            color: '#1e1b2e',
          }}
        >
          {brand.shortName}
          <span
            style={{
              background: '#7c3aed',
              color: '#fff',
              borderRadius: 12,
              padding: '2px 14px',
              fontSize: 32,
            }}
          >
            AI
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#1e1b2e',
            lineHeight: 1.1,
            letterSpacing: -1.5,
          }}
        >
          {brand.tagline}
        </div>
        <div style={{ fontSize: 30, color: '#5b5675' }}>
          Shared inbox · Broadcasts · Automations · Chatbot flows · AI assistant
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          color: '#6d28d9',
          fontWeight: 700,
        }}
      >
        {brand.urls.marketing.replace('https://', '')}
      </div>
    </div>,
    size
  );
}
