import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/config/brand';
import { findTool, TOOLS, toolHref } from '@/content/marketing/tools';
import { CtaBand, FaqAccordion, ToolCard } from '@/components/marketing/cards';
import { PageHero, Steps } from '@/components/marketing/page-blocks';
import {
  appUrl,
  Container,
  JsonLd,
  Section,
  SectionHeader,
} from '@/components/marketing/primitives';
import { ChatWidget } from '@/components/marketing/tools/chat-widget';
import { LinkGenerator } from '@/components/marketing/tools/link-generator';
import { QrGenerator } from '@/components/marketing/tools/qr-generator';
import { TextFormatter } from '@/components/marketing/tools/text-formatter';

export const dynamicParams = false;
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

const WIDGETS = {
  linkGenerator: LinkGenerator,
  qrGenerator: QrGenerator,
  textFormatter: TextFormatter,
  chatWidget: ChatWidget,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.metaDescription,
    alternates: { canonical: toolHref(slug) },
    openGraph: {
      url: toolHref(slug),
      title: `${tool.title} — ${brand.name}`,
      description: tool.metaDescription,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) notFound();
  const t = await getTranslations('Marketing');
  const Widget = WIDGETS[tool.key];
  const others = TOOLS.filter((o) => o.slug !== tool.slug);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebApplication',
              name: tool.title,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Any (web browser)',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
              description: tool.metaDescription,
            },
            {
              '@type': 'FAQPage',
              mainEntity: tool.faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ],
        }}
      />
      <PageHero
        crumbs={[
          { href: '/tools', label: t('nav.freeTools') },
          { label: t(`tools.items.${tool.key}.name`) },
        ]}
        eyebrow="Free tool"
        title={tool.title}
        subtitle={tool.subtitle}
        actions={false}
      />

      <section className="bg-mk-bg pb-16 sm:pb-20">
        <Container>
          <Widget />
        </Container>
      </section>

      <Section bg="alt" labelledBy="mk-t-steps">
        <SectionHeader id="mk-t-steps" eyebrow="How to use it" title="Three quick steps" />
        <Steps steps={tool.steps} />
      </Section>

      <Section labelledBy="mk-t-faq">
        <SectionHeader id="mk-t-faq" eyebrow="FAQ" title="Questions, answered" />
        <FaqAccordion items={tool.faq} />
      </Section>

      <Section bg="alt2" labelledBy="mk-t-more">
        <SectionHeader id="mk-t-more" eyebrow={t('nav.freeTools')} title="More free tools" />
        <div className="grid gap-5 sm:grid-cols-3">
          {others.map((o) => (
            <ToolCard
              key={o.slug}
              href={toolHref(o.slug)}
              icon={o.icon}
              name={t(`tools.items.${o.key}.name`)}
              desc={t(`tools.items.${o.key}.desc`)}
              cta={t('tools.open')}
            />
          ))}
        </div>
      </Section>

      <CtaBand
        title="Ready for more than a link?"
        subtitle="Reply to every WhatsApp chat as a team, automate the routine and send personalised broadcasts."
        primary={{ label: t('cta.primary'), href: appUrl('/signup') }}
        secondary={{ label: t('cta.secondary'), href: '/contact?topic=demo' }}
      />
    </>
  );
}
