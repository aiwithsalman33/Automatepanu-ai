/**
 * Single source of truth for the brand: name, tagline, domains, contact
 * and social links. Used by the marketing site, metadata/JSON-LD, emails
 * and auth (trusted origins).
 *
 * Domains are overridable per deployment through env (see
 * .env.example): NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_MARKETING_URL.
 * The values below are the production defaults.
 */
export const brand = {
  name: 'Automate Panu AI',
  shortName: 'Automate Panu',
  tagline: 'Run your WhatsApp business from one shared inbox.',
  description:
    'Shared team inbox, contacts, sales pipelines, broadcasts, no-code automations, chatbot flows and an AI reply assistant on the official WhatsApp Business API.',

  urls: {
    /**
     * Marketing site (this repo's (marketing) route group). Served at `/`
     * on the app's own domain; a separate website domain is optional
     * (NEXT_PUBLIC_MARKETING_URL turns on the two-domain split).
     */
    marketing: 'https://chat.axxeler.in',
    /** The CRM app (sign in / sign up live here). */
    app: 'https://chat.axxeler.in',
  },

  /** PLACEHOLDERS — replace with real contact details before launch. */
  contact: {
    email: '[REPLACE: hello@your-domain]',
    salesEmail: '[REPLACE: sales@your-domain]',
    securityEmail: 'security@axxeler.in',
  },

  /** PLACEHOLDERS — set the real profile URLs or remove entries. */
  social: [
    { id: 'linkedin', label: 'LinkedIn', href: '#replace-linkedin' },
    { id: 'x', label: 'X (Twitter)', href: '#replace-x' },
    { id: 'youtube', label: 'YouTube', href: '#replace-youtube' },
    { id: 'instagram', label: 'Instagram', href: '#replace-instagram' },
  ],

  logo: {
    mark: '/brand/logo-mark.svg',
    full: '/brand/logo.svg',
    fullOnDark: '/brand/logo-white.svg',
  },
} as const;

/** Origin (scheme://host[:port]) of a URL, or null if it isn't one. */
export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** App origin for this deployment: env first, then the brand default. */
export function appOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return (
    originOf(env.NEXT_PUBLIC_APP_URL) ??
    originOf(env.NEXT_PUBLIC_SITE_URL) ??
    brand.urls.app
  );
}

/** Marketing origin for this deployment: env first, then the brand default. */
export function marketingOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return originOf(env.NEXT_PUBLIC_MARKETING_URL) ?? brand.urls.marketing;
}
