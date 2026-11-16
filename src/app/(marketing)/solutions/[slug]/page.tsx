import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { X } from 'lucide-react';
import { brand } from '@/config/brand';
import { SOLUTION_SLUGS, type SolutionSlug } from '@/content/marketing/nav';
import { SOLUTION_PAGES } from '@/content/marketing/pages';
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
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

const isSolution = (s: string): s is SolutionSlug =>
  (SOLUTION_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSolution(slug)) return {};
  const t = await getTranslations('Marketing');
  const page = SOLUTION_PAGES[slug];
  const title = `WhatsApp for ${t(`nav.solutionItems.${slug}.title`)}`;
  return {
    title,
    description: page.metaDescription,
    alternates: { canonical: `/solutions/${slug}` },
    openGraph: {
      url: `/solutions/${slug}`,
      title: `${title} — ${brand.name}`,
      description: page.metaDescription,
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSolution(slug)) notFound();
  const t = await getTranslations('Marketing');
  const page = SOLUTION_PAGES[slug];
  const name = t(`nav.solutionItems.${slug}.title`);

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
        crumbs={[{ label: t('nav.solutions') }, { label: name }]}
        eyebrow={page.eyebrow}
        title={page.title}
        subtitle={page.subtitle}
        visual={<PageVisual visual={page.visual} />}
      />

      <Section bg="alt" labelledBy="mk-s-problems">
        <SectionHeader
          id="mk-s-problems"
          eyebrow="The problem"
          title="Sound familiar?"
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {page.problems.map((p) => (
            <div
              key={p.title}
              className="border-mk-border rounded-2xl border bg-white p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <X aria-hidden className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-bold">{p.title}</h3>
              <p className="text-mk-body mt-2 text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section labelledBy="mk-s-outcomes">
        <SectionHeader
          id="mk-s-outcomes"
          eyebrow="How we help"
          title="What changes with Automate"
        />
        <PointGrid points={page.outcomes} columns={4} />
      </Section>

      <Section bg="alt" labelledBy="mk-s-journey">
        <SectionHeader
          id="mk-s-journey"
          eyebrow="In practice"
          title="How a conversation flows"
        />
        <Steps steps={page.journey} />
      </Section>

      <Section labelledBy="mk-s-features">
        <SectionHeader
          id="mk-s-features"
          eyebrow="Features"
          title="The tools behind it"
        />
        <LinkCards
          items={page.features.map((f) => ({
            href: `/features/${f}`,
            title: t(`nav.features.${f}.title`),
            desc: t(`nav.features.${f}.desc`),
          }))}
        />
      </Section>

      <Section bg="alt" labelledBy="mk-s-faq">
        <SectionHeader id="mk-s-faq" eyebrow="FAQ" title="Questions, answered" />
        <FaqAccordion items={page.faq} />
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
