import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Refund policy',
  description: `Cancellations and refunds for ${brand.name}.`,
  alternates: { canonical: '/refund-policy' },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund policy"
      updated="2026-11-16"
      intro="How cancellations and refunds work."
    >
      <h2>1. Cancelling</h2>
      <p>
        You can cancel any time from your account or by contacting us. Your
        access continues until the end of the period you have already paid
        for, and you will not be charged again.
      </p>

      <h2>2. Refunds</h2>
      <p>
        If you were charged by mistake, or something went wrong on our side,
        contact us within 7 days of the charge and we will review it and
        refund where appropriate.
      </p>

      <h2>3. Charges from other providers</h2>
      <p>
        WhatsApp conversation charges are billed by Meta, and AI usage is
        billed by the AI provider whose key you connect. Those charges are
        between you and the provider and can’t be refunded by us.
      </p>

      <h2>4. How to request a refund</h2>
      <p>
        <Link href="/contact">Contact us</Link> with your account email and
        the charge date. Approved refunds go back to the original payment
        method.
      </p>
    </LegalPage>
  );
}
