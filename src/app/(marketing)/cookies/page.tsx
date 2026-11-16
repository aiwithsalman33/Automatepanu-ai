import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Cookie policy',
  description: `The cookies ${brand.name} uses and why.`,
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      updated="2026-11-16"
      intro="We keep cookies to the minimum needed to run the service. No advertising or tracking cookies."
    >
      <h2>Cookies we use</h2>
      <ul>
        <li>
          <strong>Session cookie</strong> (<code>wacrm.session_token</code>):
          keeps you signed in. Essential; set only when you sign in.
        </li>
        <li>
          <strong>Preferences</strong> (stored in your browser): your chosen
          theme and light/dark mode.
        </li>
      </ul>
      <p>
        The website and the free tools set no cookies. We don’t use
        third-party analytics, advertising or social media cookies.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser settings. Blocking the
        session cookie means you can’t stay signed in.
      </p>

      <h2>Questions</h2>
      <p>
        See our <Link href="/privacy">privacy policy</Link> or{' '}
        <Link href="/contact">contact us</Link>.
      </p>
    </LegalPage>
  );
}
