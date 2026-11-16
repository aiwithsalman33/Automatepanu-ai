import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/config/brand';
import { FEATURE_SLUGS, type FeatureSlug } from '@/content/marketing/nav';
import { FEATURE_PAGES } from '@/content/marketing/pages';
import { CtaBand, FaqAccordion } from '@/components/marketing/cards';
import {
  LinkCards,
  PageHero,
  PageVisual,
  PointGrid,
  Steps,
} from '@/components/marketing/page-blocks';
import {
  appUrl,
  JsonLd,
  Section,
  SectionHeader,
} from '@/components/marketing/primitives';

export const dynamicParams = false;
export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

const isFeature = (s: string): s is FeatureSlug =>
  (FEATURE_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isFeature(slug)) return {};
  const t = await getTranslations('Marketing');
  const page = FEATURE_PAGES[slug];
  const title = t(`nav.features.${slug}.title`);
  return {
    title,
    description: page.metaDescription,
    alternates: { canonical: `/features/${slug}` },
    openGraph: {
      url: `/features/${slug}`,
      title: `${title} — ${brand.name}`,
      description: page.metaDescription,
    },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isFeature(slug)) notFound();
  const t = await getTranslations('Marketing');
  const page = FEATURE_PAGES[slug];
  const name = t(`nav.features.${slug}.title`);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: page.faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <PageHero
        crumbs={[{ label: t('nav.product') }, { label: name }]}
        eyebrow={page.eyebrow}
        title={page.title}
        subtitle={page.subtitle}
        visual={<PageVisual visual={page.visual} />}
      />

      <Section bg="alt" labelledBy="mk-f-highlights">
        <SectionHeader
          id="mk-f-highlights"
          eyebrow={name}
          title="Everything it does for your team"
        />
        <PointGrid points={page.highlights} />
      </Section>

      <Section labelledBy="mk-f-steps">
        <SectionHeader
          id="mk-f-steps"
          eyebrow="How it works"
          title="Up and running in three steps"
        />
        <Steps steps={page.steps} />
      </Section>

      <Section bg="alt" labelledBy="mk-f-faq">
        <SectionHeader id="mk-f-faq" eyebrow="FAQ" title="Questions, answered" />
        <FaqAccordion items={page.faq} />
      </Section>

      <Section labelledBy="mk-f-related">
        <SectionHeader
          id="mk-f-related"
          eyebrow="Keep exploring"
          title="Works even better with"
        />
        <LinkCards
          items={page.related.map((r) => ({
            href: `/features/${r}`,
            title: t(`nav.features.${r}.title`),
            desc: t(`nav.features.${r}.desc`),
          }))}
        />
      </Section>

      <CtaBand
        title={t('cta.title')}
        subtitle={t('cta.subtitle')}
        primary={{ label: t('cta.primary'), href: appUrl('/signup') }}
        secondary={{ label: t('cta.secondary'), href: '/contact?topic=demo' }}
      />
    </>
  );
}
