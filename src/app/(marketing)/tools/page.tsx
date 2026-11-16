import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TOOLS, toolHref } from '@/content/marketing/tools';
import { CtaBand, ToolCard } from '@/components/marketing/cards';
import { PageHero } from '@/components/marketing/page-blocks';
import { appUrl, Container } from '@/components/marketing/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Marketing');
  return {
    title: t('tools.title'),
    description: t('tools.subtitle'),
    alternates: { canonical: '/tools' },
  };
}

export default async function ToolsHub() {
  const t = await getTranslations('Marketing');
  return (
    <>
      <PageHero
        crumbs={[{ label: t('nav.freeTools') }]}
        eyebrow={t('tools.eyebrow')}
        title={t('tools.title')}
        subtitle={t('tools.subtitle')}
        actions={false}
      />
      <section className="bg-mk-bg pb-20">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.slug}
                href={toolHref(tool.slug)}
                icon={tool.icon}
                name={t(`tools.items.${tool.key}.name`)}
                desc={tool.subtitle}
                cta={t('tools.open')}
              />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand
        title={t('cta.title')}
        subtitle={t('cta.subtitle')}
        primary={{ label: t('cta.primary'), href: appUrl('/signup') }}
        secondary={{ label: t('cta.secondary'), href: '/contact?topic=demo' }}
      />
    </>
  );
}
