import type { ReactNode } from 'react';
import { PageHero, Prose } from './page-blocks';
import { Container } from './primitives';

/** Shared frame for the legal pages (privacy, terms, refunds, cookies). */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** ISO date */
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Legal' }, { label: title }]}
        eyebrow="Legal"
        title={title}
        subtitle={intro}
        actions={false}
      >
        <p className="text-mk-muted mt-4 text-sm">
          Last updated{' '}
          <time dateTime={updated}>
            {new Date(updated).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </p>
      </PageHero>
      <section className="bg-mk-bg pb-20">
        <Container>
          <Prose>{children}</Prose>
        </Container>
      </section>
    </>
  );
}
