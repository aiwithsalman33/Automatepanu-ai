import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `The terms that apply when you use ${brand.name}.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="2026-11-16"
      intro={`These terms apply when you create an account or use ${brand.name}. By using the service you agree to them.`}
    >
      <h2>1. The service</h2>
      <p>
        {brand.name} provides software to manage WhatsApp conversations,
        contacts, campaigns and automations through Meta’s official WhatsApp
        Business Platform. Features may change as we improve the service.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must give accurate information and keep your password safe.</li>
        <li>
          You are responsible for everything done in your workspace, including
          by teammates you invite.
        </li>
        <li>You must be able to form a binding contract to use the service.</li>
      </ul>

      <h2>3. WhatsApp and Meta</h2>
      <p>
        You connect your own WhatsApp Business number and Meta app. You must
        follow the{' '}
        <a href="https://www.whatsapp.com/legal/business-policy" rel="noopener noreferrer" target="_blank">
          WhatsApp Business Policy
        </a>{' '}
        and Meta’s terms, including getting customers’ opt-in before messaging
        them. Meta may charge you directly for conversations; those charges
        are between you and Meta. We are not affiliated with Meta.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use the service to:</p>
      <ul>
        <li>send spam or messages to people who haven’t opted in;</li>
        <li>send unlawful, fraudulent, abusive or infringing content;</li>
        <li>try to break, overload or gain unauthorised access to the service;</li>
        <li>resell the service without our written permission.</li>
      </ul>
      <p>We may suspend accounts that break these rules.</p>

      <h2>5. Your data</h2>
      <p>
        You own the data you put into the service. You give us permission to
        host and process it only to provide the service, as described in our{' '}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        If you connect an AI provider or other service, your use of it is
        governed by that provider’s terms and billed by them.
      </p>

      <h2>7. Availability</h2>
      <p>
        We work to keep the service available and secure but provide it “as
        is”, without guarantees of uninterrupted operation. WhatsApp delivery
        also depends on Meta.
      </p>

      <h2>8. Liability</h2>
      <p>
        To the extent allowed by law, we are not liable for indirect or
        consequential losses, and our total liability is limited to the
        amount you paid us in the 12 months before the claim.
      </p>

      <h2>9. Ending the agreement</h2>
      <p>
        You can stop using the service and delete your account at any time.
        We may end or suspend access for serious or repeated breaches of
        these terms.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. If changes are significant we will notify
        account owners before they take effect.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <Link href="/contact">contact us</Link>.
      </p>
    </LegalPage>
  );
}
