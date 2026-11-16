import type { Metadata, Viewport } from 'next';
import { getTranslations } from 'next-intl/server';
import { brand, marketingOrigin } from '@/config/brand';
import { Footer, QuickLinks } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { IntlProvider } from '@/components/intl-provider';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Marketing');
  return {
    metadataBase: new URL(marketingOrigin()),
    title: {
      default: `${brand.name} — ${t('meta.homeTitle')}`,
      template: `%s — ${brand.name}`,
    },
    description: t('meta.homeDescription'),
    // The app is noindex (root layout); the public site is indexable.
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: brand.name, locale: 'en_IN' },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('Marketing');
  return (
    <IntlProvider namespaces={['Marketing']}>
      <div className="mk min-h-screen">
        <a
          href="#main"
          className="bg-mk-primary sr-only z-60 rounded-full px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-4"
        >
          {t('skipToContent')}
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <QuickLinks />
        <Footer />
      </div>
    </IntlProvider>
  );
}
