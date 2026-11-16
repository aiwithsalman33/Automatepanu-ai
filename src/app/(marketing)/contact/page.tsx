import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  Mail,
  MessageCircle,
  Presentation,
} from 'lucide-react';
import { brand } from '@/config/brand';
import { ContactForm } from '@/components/marketing/contact-form';
import { PageHero } from '@/components/marketing/page-blocks';
import { Container } from '@/components/marketing/primitives';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Talk to the Automate team: book a demo or ask a question about our WhatsApp CRM.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const isDemo = topic === 'demo';
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Contact' }]}
        eyebrow={isDemo ? 'Book a demo' : 'Contact'}
        title={isDemo ? 'See Automate in action' : 'Talk to us'}
        subtitle={
          isDemo
            ? 'Tell us a little about your team and we’ll show you how Automate fits the way you sell and support on WhatsApp.'
            : 'Questions about features, setup or anything else? Send us a message and we’ll get back to you.'
        }
        actions={false}
      />
      <section className="bg-mk-bg pb-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <ul className="space-y-6">
            {[
              {
                icon: MessageCircle,
                title: 'WhatsApp',
                desc: (
                  <a
                    href={`https://wa.me/${brand.contact.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mk-primary-hover font-semibold underline"
                  >
                    {brand.contact.whatsappDisplay}
                  </a>
                ),
              },
              {
                icon: Mail,
                title: 'Email',
                desc: (
                  <a
                    href={`mailto:${brand.contact.email}`}
                    className="text-mk-primary-hover font-semibold underline"
                  >
                    {brand.contact.email}
                  </a>
                ),
              },
              {
                icon: Clock,
                title: 'Quick replies',
                desc: 'We usually answer within one business day.',
              },
              {
                icon: Presentation,
                title: 'Personal demo',
                desc: 'A short call tailored to your use case: sales, support or campaigns.',
              },
              {
                icon: BookOpen,
                title: 'Prefer to explore first?',
                desc: (
                  <>
                    Read the{' '}
                    <Link href="/docs" className="text-mk-primary-hover font-semibold underline">
                      getting started guide
                    </Link>
                    .
                  </>
                ),
              },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <span className="bg-mk-soft text-mk-primary-hover inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold">{title}</h2>
                  <p className="text-mk-body mt-1 text-sm">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <ContactForm initialTopic={isDemo ? 'demo' : 'general'} />
        </Container>
      </section>
    </>
  );
}
