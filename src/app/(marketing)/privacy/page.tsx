import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${brand.name} collects, uses and protects your data.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="2026-11-16"
      intro={`How ${brand.name} collects, uses and protects personal data when you use our website and service.`}
    >
      <h2>1. Who we are</h2>
      <p>
        {brand.name} (“we”, “us”) provides a WhatsApp customer messaging and
        CRM service at {brand.urls.app}. For your customers’ data that you
        store in the service, you are the controller and we act as your
        processor.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your name, email address, password
          (stored only as a secure hash) and workspace settings.
        </li>
        <li>
          <strong>Customer data you process:</strong> contacts, WhatsApp
          messages, media, tags, notes and deals that you or your team handle
          in the service.
        </li>
        <li>
          <strong>Credentials:</strong> WhatsApp access tokens and AI provider
          keys you connect, stored encrypted (AES-256-GCM).
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type and
          session information needed to keep you signed in and protect the
          service from abuse.
        </li>
        <li>
          <strong>Contact form:</strong> the details you send us when you get
          in touch.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To provide, secure and support the service.</li>
        <li>To send account emails (verification, password reset, invites).</li>
        <li>To reply when you contact us.</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        We do not sell personal data and we do not use your customers’
        messages to train AI models.
      </p>

      <h2>4. Service providers</h2>
      <p>We share data only as needed to run the service:</p>
      <ul>
        <li>
          <strong>Meta (WhatsApp Business Platform)</strong> to send and
          receive WhatsApp messages.
        </li>
        <li>
          <strong>Your chosen AI provider</strong> (e.g. OpenAI, Anthropic),
          only if you connect a key, to generate replies.
        </li>
        <li>
          <strong>Our email provider</strong> to deliver account emails.
        </li>
        <li>
          <strong>Our hosting provider</strong> where the service and its
          database run.
        </li>
      </ul>

      <h2>5. Security</h2>
      <p>
        Each workspace’s data is isolated in the database with row-level
        security, credentials are encrypted at rest, connections use HTTPS
        and incoming WhatsApp webhooks are verified with Meta’s signature.
      </p>

      <h2>6. Retention</h2>
      <p>
        We keep account and customer data for as long as your account is
        active. When you delete data or close your account, it is removed
        from the live service and from backups as they expire.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You can access, correct, export or delete your data, and object to or
        restrict certain processing, subject to applicable law. If you are a
        customer of one of our users, please contact that business first.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use only essential cookies. See our{' '}
        <Link href="/cookies">cookie policy</Link>.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy. We will change the date above and, for
        significant changes, notify account owners by email.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or requests: <Link href="/contact">contact us</Link>.
        Security issues: {brand.contact.securityEmail}.
      </p>
    </LegalPage>
  );
}
