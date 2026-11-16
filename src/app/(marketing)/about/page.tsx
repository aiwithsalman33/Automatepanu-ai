import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { CtaBand } from '@/components/marketing/cards';
import { PageHero, PointGrid } from '@/components/marketing/page-blocks';
import {
  appUrl,
  Section,
  SectionHeader,
} from '@/components/marketing/primitives';

export const metadata: Metadata = {
  title: 'About us',
  description: `${brand.name} helps teams sell and support customers on WhatsApp with a shared inbox, automations and AI, on the official WhatsApp Business API.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: 'About' }]}
        eyebrow="About us"
        title="We help businesses talk to customers where they already are"
        subtitle={`Your customers live on WhatsApp. ${brand.name} gives your whole team one place to reply, follow up and automate those conversations, without passing a phone around.`}
        actions={false}
      />
      <Section bg="alt" labelledBy="mk-about-values">
        <SectionHeader
          id="mk-about-values"
          eyebrow="What we believe"
          title="How we build"
        />
        <PointGrid
          points={[
            {
              icon: 'shield',
              title: 'Official and secure',
              desc: 'Built only on Meta’s official WhatsApp Business Cloud API. Every account’s data is isolated and tokens are encrypted.',
            },
            {
              icon: 'users',
              title: 'Made for teams',
              desc: 'Shared inbox, roles and handoffs so everyone works the same number without stepping on each other.',
            },
            {
              icon: 'key',
              title: 'Your keys, your data',
              desc: 'Bring your own AI key and pay the provider directly. Your WhatsApp number always stays yours.',
            },
            {
              icon: 'sparkles',
              title: 'Simple first',
              desc: 'Powerful automations and flows, without code and without a week of setup.',
            },
            {
              icon: 'globe',
              title: 'For businesses that run on WhatsApp',
              desc: 'From local shops to growing teams, with the app available in four languages.',
            },
            {
              icon: 'headset',
              title: 'Humans behind it',
              desc: 'Real people help you set up and answer your questions.',
            },
          ]}
        />
      </Section>
      <CtaBand
        title="Let’s bring your WhatsApp team together"
        subtitle="Start free, or talk to us about what you need."
        primary={{ label: 'Start free', href: appUrl('/signup') }}
        secondary={{ label: 'Contact us', href: '/contact' }}
      />
    </>
  );
}
