import type { MetadataRoute } from 'next';
import { marketingOrigin } from '@/config/brand';

// The CRM and auth screens (they also send noindex).
const PRIVATE = [
  '/api/',
  '/login',
  '/signup',
  '/join',
  '/auth',
  '/dashboard',
  '/inbox',
  '/contacts',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/flows',
  '/agents',
  '/notifications',
  '/settings',
  '/admin',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE,
    },
    sitemap: `${marketingOrigin()}/sitemap.xml`,
  };
}
