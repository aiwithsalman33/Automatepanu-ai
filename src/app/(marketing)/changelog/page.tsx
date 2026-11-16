import type { Metadata } from 'next';
import { CHANGELOG } from '@/content/marketing/changelog';
import { PageHero } from '@/components/marketing/page-blocks';
import { Badge, Container } from '@/components/marketing/primitives';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Every improvement and fix shipped to Automate, newest first.',
  alternates: { canonical: '/changelog' },
};

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Resources' }, { label: 'Changelog' }]}
        eyebrow="Changelog"
        title="What’s new"
        subtitle="Every improvement and fix we ship, newest first."
        actions={false}
      />
      <section className="bg-mk-bg pb-20">
        <Container>
          <ol className="border-mk-border relative max-w-3xl space-y-8 border-l pl-8">
            {CHANGELOG.map((e) => (
              <li key={e.version} className="relative">
                <span
                  aria-hidden
                  className="bg-mk-primary absolute top-2 -left-[37px] h-3 w-3 rounded-full ring-4 ring-white"
                />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge tone={e.tag === 'New' ? 'solid' : 'muted'}>
                    {e.tag}
                  </Badge>
                  <span className="text-mk-heading font-semibold">
                    v{e.version}
                  </span>
                  <time dateTime={e.date} className="text-mk-muted">
                    {new Date(e.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <h2 className="mt-2 text-xl font-bold">{e.title}</h2>
                <p className="text-mk-body mt-1">{e.summary}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}
