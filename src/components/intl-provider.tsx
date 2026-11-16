import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Supplies next-intl messages to the client components of ONE route group.
 *
 * The provider used to live in the root layout with the whole catalogue,
 * so every page, including the public marketing site, shipped every
 * app string (~280 KB of HTML) to the browser. Each route group now
 * wraps itself and passes only what its client components need:
 *   app groups ((dashboard), (auth), join): full catalogue (default)
 *   (marketing): namespaces={['Marketing']}
 * Server components are unaffected (getTranslations reads the request
 * config directly).
 */
export async function IntlProvider({
  children,
  namespaces,
}: {
  children: ReactNode;
  namespaces?: string[];
}) {
  const [locale, all] = await Promise.all([getLocale(), getMessages()]);
  const messages = namespaces
    ? Object.fromEntries(
        namespaces.filter((n) => n in all).map((n) => [n, all[n]])
      )
    : all;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
