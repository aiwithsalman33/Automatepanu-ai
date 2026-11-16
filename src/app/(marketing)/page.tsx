import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Check } from 'lucide-react';
import { brand, marketingOrigin } from '@/config/brand';
import { CHANGELOG } from '@/content/marketing/changelog';
import { LOGOS } from '@/content/marketing/logos';
import { TOOLS, toolHref } from '@/content/marketing/tools';
import {
  CtaBand,
  FaqAccordion,
  FeatureCard,
  LogoMarquee,
  StatTile,
  ToolCard,
} from '@/components/marketing/cards';
import {
  PricingPreview,
  Reveal,
  UseCaseTabs,
} from '@/components/marketing/interactive';
import {
  DeepDiveVisual,
  HeroInboxMock,
  MiniMock,
  type HeroMockLabels,
} from '@/components/marketing/mocks';
import {
  appUrl,
  Badge,
  Container,
  JsonLd,
  MkButton,
  Section,
  SectionHeader,
} from '@/components/marketing/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Marketing');
  return {
    title: { absolute: `${brand.name} — ${t('meta.homeTitle')}` },
    description: t('meta.homeDescription'),
    alternates: { canonical: '/' },
    openGraph: {
      url: '/',
      title: `${brand.name} — ${t('meta.homeTitle')}`,
      description: t('meta.homeDescription'),
    },
  };
}

// Ordered to fill three 4-column rows exactly (spans: 2+1+1 | 1+1+1+1 | 2+2).
const BENTO = [
  { key: 'inbox', span: 'lg:col-span-2' },
  { key: 'contacts', span: '' },
  { key: 'pipelines', span: '' },
  { key: 'broadcasts', span: '' },
  { key: 'automations', span: '' },
  { key: 'flows', span: '' },
  { key: 'multiNumber', span: '', comingSoon: true },
  { key: 'ai', span: 'lg:col-span-2' },
  { key: 'api', span: 'lg:col-span-2' },
] as const;

const DEEP_DIVES = ['inbox', 'automations', 'ai', 'broadcasts'] as const;
const FAQ_KEYS = [
  'number',
  'official',
  'window',
  'ai',
  'security',
  'roles',
  'api',
  'languages',
  'pricing',
  'cancel',
] as const;
const STAT_KEYS = ['api', 'roles', 'providers', 'languages'] as const;

export default async function HomePage() {
  const t = await getTranslations('Marketing');
  const heroLabels = Object.fromEntries(
    (
      [
        'inboxLabel',
        'open',
        'contactName',
        'contactTag',
        'msgIn1',
        'msgOut1',
        'msgIn2',
        'aiBadge',
        'aiDraft',
        'assignedTo',
        'windowLeft',
        'cardDeal',
        'cardBroadcast',
        'cardFlow',
      ] as const
    ).map((k) => [k, t(`hero.mock.${k}`)])
  ) as unknown as HeroMockLabels;
  const faq = FAQ_KEYS.map((k) => ({
    q: t(`faq.items.${k}.q`),
    a: t(`faq.items.${k}.a`),
  }));
  const origin = marketingOrigin();

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${origin}/#org`,
              name: brand.name,
              url: origin,
              logo: `${origin}${brand.logo.mark}`,
            },
            {
              '@type': 'WebSite',
              '@id': `${origin}/#website`,
              name: brand.name,
              url: origin,
              publisher: { '@id': `${origin}/#org` },
            },
            {
              '@type': 'FAQPage',
              mainEntity: faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ],
        }}
      />

      {/* 1 + 3. Announcement + hero (no Reveal above the fold: LCP) */}
      <section className="bg-mk-bg relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#ede9fe,transparent)]" />
          <div className="absolute top-40 right-[-10%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,#f3e8ff,transparent)]" />
        </div>
        <Container className="relative grid items-center gap-14 pt-12 pb-20 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
          <div>
            <Link
              href="/changelog"
              className="border-mk-soft2 text-mk-heading hover:border-mk-primary inline-flex items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1 text-sm shadow-sm"
            >
              <Badge tone="solid">{t('announcement.label')}</Badge>
              <span className="font-medium">{t('announcement.text')}</span>
              <ArrowRight aria-hidden className="text-mk-primary h-4 w-4" />
            </Link>
            <p className="text-mk-primary-hover mt-6 text-sm font-semibold tracking-wider uppercase">
              {t('hero.eyebrow')}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl lg:text-[3.4rem]">
              {t('hero.title')}
            </h1>
            <p className="text-mk-body mt-5 max-w-xl text-lg">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MkButton href={appUrl('/signup')} size="lg">
                {t('hero.primaryCta')}{' '}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </MkButton>
              <MkButton href="/pricing" variant="secondary" size="lg">
                {t('hero.secondaryCta')}
              </MkButton>
            </div>
            <ul className="text-mk-body mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {(['official', 'byok', 'roles'] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <Check aria-hidden className="text-mk-primary h-4 w-4" />{' '}
                  {t(`hero.ticks.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <HeroInboxMock l={heroLabels} />
        </Container>
      </section>

      {/* 4. Logo marquee (placeholders) */}
      <LogoMarquee
        title={t('logos.title')}
        logos={LOGOS}
        placeholderLabel={t('logos.placeholder')}
      />

      {/* 5. One platform bento */}
      <Section bg="alt" labelledBy="mk-bento-title">
        <SectionHeader
          id="mk-bento-title"
          eyebrow={t('bento.eyebrow')}
          title={t('bento.title')}
          subtitle={t('bento.subtitle')}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENTO.map((b, i) => (
            <Reveal key={b.key} className={b.span} delay={(i % 4) * 60}>
              <FeatureCard
                className="h-full"
                title={t(`bento.items.${b.key}.title`)}
                desc={t(`bento.items.${b.key}.desc`)}
                badge={
                  'comingSoon' in b && b.comingSoon
                    ? t('bento.comingSoon')
                    : undefined
                }
                visual={<MiniMock kind={b.key} />}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 6. Deep dives */}
      {DEEP_DIVES.map((k, i) => (
        <Section key={k} bg={i % 2 ? 'alt' : 'white'} labelledBy={`mk-dd-${k}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className={i % 2 ? 'lg:order-2' : ''}>
              <Badge>{t(`deepDive.${k}.eyebrow`)}</Badge>
              <h2
                id={`mk-dd-${k}`}
                className="mt-4 text-3xl font-extrabold sm:text-4xl"
              >
                {t(`deepDive.${k}.title`)}
              </h2>
              <p className="text-mk-body mt-4 text-lg">
                {t(`deepDive.${k}.body`)}
              </p>
              <ul className="mt-6 space-y-3">
                {(['a', 'b', 'c'] as const).map((p) => (
                  <li key={p} className="text-mk-heading flex gap-3">
                    <span className="bg-mk-soft mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      <Check
                        aria-hidden
                        className="text-mk-primary-hover h-3.5 w-3.5"
                      />
                    </span>
                    {t(`deepDive.${k}.points.${p}`)}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <DeepDiveVisual kind={k} />
            </Reveal>
          </div>
        </Section>
      ))}

      {/* 7. Stats (true product facts, no invented numbers) */}
      <Section bg="alt2" labelledBy="mk-stats-title">
        <h2
          id="mk-stats-title"
          className="mb-10 text-center text-2xl font-extrabold sm:text-3xl"
        >
          {t('stats.title')}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_KEYS.map((k) => (
            <StatTile
              key={k}
              value={t(`stats.items.${k}.value`)}
              label={t(`stats.items.${k}.label`)}
            />
          ))}
        </div>
      </Section>

      {/* 8. What's new */}
      <Section labelledBy="mk-new-title">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge>{t('whatsNew.eyebrow')}</Badge>
            <h2 id="mk-new-title" className="mt-4 text-3xl font-extrabold">
              {t('whatsNew.title')}
            </h2>
          </div>
          <Link
            href="/changelog"
            className="text-mk-primary-hover text-sm font-semibold hover:underline"
          >
            {t('whatsNew.all')} →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CHANGELOG.slice(0, 4).map((e) => (
            <Reveal key={e.version}>
              <article className="border-mk-border shadow-mk h-full rounded-2xl border bg-white p-5">
                <div className="flex items-center justify-between text-xs">
                  <Badge tone={e.tag === 'New' ? 'solid' : 'muted'}>
                    {e.tag}
                  </Badge>
                  <time dateTime={e.date} className="text-mk-muted">
                    {new Date(e.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <h3 className="mt-3 font-bold">{e.title}</h3>
                <p className="text-mk-body mt-1 text-sm">{e.summary}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 9. Pricing preview */}
      <Section bg="alt" id="pricing" labelledBy="mk-pricing-title">
        <SectionHeader
          id="mk-pricing-title"
          eyebrow={t('pricing.eyebrow')}
          title={t('pricing.title')}
          subtitle={t('pricing.subtitle')}
        />
        <PricingPreview />
        <p className="mt-4 text-center">
          <Link
            href="/pricing"
            className="text-mk-primary-hover text-sm font-semibold hover:underline"
          >
            {t('pricing.compare')} →
          </Link>
        </p>
      </Section>

      {/* 10. Use cases */}
      <Section labelledBy="mk-uc-title">
        <SectionHeader
          id="mk-uc-title"
          eyebrow={t('useCases.eyebrow')}
          title={t('useCases.title')}
        />
        <UseCaseTabs />
      </Section>

      {/* 11. FAQ */}
      <Section bg="alt" labelledBy="mk-faq-title">
        <SectionHeader
          id="mk-faq-title"
          eyebrow={t('faq.eyebrow')}
          title={t('faq.title')}
        />
        <FaqAccordion items={faq} />
      </Section>

      {/* 12. CTA band */}
      <CtaBand
        title={t('cta.title')}
        subtitle={t('cta.subtitle')}
        primary={{ label: t('cta.primary'), href: appUrl('/signup') }}
        secondary={{ label: t('cta.secondary'), href: '/contact?topic=demo' }}
      />

      {/* 13. Free tools strip */}
      <Section bg="alt2" labelledBy="mk-tools-title">
        <SectionHeader
          id="mk-tools-title"
          eyebrow={t('tools.eyebrow')}
          title={t('tools.title')}
          subtitle={t('tools.subtitle')}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.slug}
              href={toolHref(tool.slug)}
              icon={tool.icon}
              name={t(`tools.items.${tool.key}.name`)}
              desc={t(`tools.items.${tool.key}.desc`)}
              cta={t('tools.open')}
            />
          ))}
        </div>
        <p className="mt-8 text-center">
          <MkButton href="/tools" variant="secondary">
            {t('tools.all')}
          </MkButton>
        </p>
      </Section>
    </>
  );
}
