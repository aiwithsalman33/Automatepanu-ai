/**
 * Marketing navigation structure (navbar dropdowns + footer columns).
 * Labels are i18n keys under Marketing.nav.*.
 */
export const FEATURE_SLUGS = [
  'inbox',
  'broadcasts',
  'automations',
  'flows',
  'ai-assistant',
  'api',
] as const;
export const SOLUTION_SLUGS = [
  'sales',
  'support',
  'agencies',
  'ecommerce',
  'education',
] as const;

export type FeatureSlug = (typeof FEATURE_SLUGS)[number];
export type SolutionSlug = (typeof SOLUTION_SLUGS)[number];

/** Resources links (key under Marketing.nav.resources.*). */
export const RESOURCES = [
  { key: 'docs', href: '/docs' },
  { key: 'changelog', href: '/changelog' },
  { key: 'api', href: '/features/api' },
  { key: 'contact', href: '/contact' },
] as const;

export const COMPANY = [
  { key: 'about', href: '/about' },
  { key: 'contact', href: '/contact' },
  { key: 'demo', href: '/contact?topic=demo' },
] as const;

export const LEGAL = [
  { key: 'privacy', href: '/privacy' },
  { key: 'terms', href: '/terms' },
  { key: 'refunds', href: '/refund-policy' },
  { key: 'cookies', href: '/cookies' },
] as const;
