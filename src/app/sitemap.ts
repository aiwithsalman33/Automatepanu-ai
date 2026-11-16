import type { MetadataRoute } from 'next';
import { marketingOrigin } from '@/config/brand';
import { FEATURE_SLUGS, SOLUTION_SLUGS } from '@/content/marketing/nav';
import { TOOLS, toolHref } from '@/content/marketing/tools';

/** Public website pages only (the CRM itself is noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = marketingOrigin();
  const paths = [
    '/',
    ...FEATURE_SLUGS.map((s) => `/features/${s}`),
    ...SOLUTION_SLUGS.map((s) => `/solutions/${s}`),
    '/tools',
    ...TOOLS.map((t) => toolHref(t.slug)),
    '/docs',
    '/changelog',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/refund-policy',
    '/cookies',
  ];
  return paths.map((p) => ({
    url: `${origin}${p === '/' ? '' : p}`,
    changeFrequency: p === '/' || p === '/changelog' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p.startsWith('/features') || p.startsWith('/tools') ? 0.8 : 0.5,
  }));
}
