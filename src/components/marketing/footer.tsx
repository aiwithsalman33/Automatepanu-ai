import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/config/brand';
import {
  COMPANY,
  FEATURE_SLUGS,
  LEGAL,
  RESOURCES,
  SOLUTION_SLUGS,
} from '@/content/marketing/nav';
import { TOOLS, toolHref } from '@/content/marketing/tools';
import { Logo } from './logo';
import { Container } from './primitives';

/** Minimal brand glyphs (lucide v1 has no brand icons). */
const SOCIAL_ICONS: Record<string, string> = {
  linkedin:
    'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.6 8.65 21 11.3 21 14.7V21h-4v-5.6c0-1.34-.03-3.06-1.86-3.06-1.87 0-2.15 1.46-2.15 2.96V21H9z',
  x: 'M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.17h1.7L7.4 4.73H5.58z',
  youtube:
    'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.75 15.02V8.98L15.5 12z',
  instagram:
    'M12 2.2c3.2 0 3.58 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 4.86a4.94 4.94 0 1 0 0 9.88 4.94 4.94 0 0 0 0-9.88zm0 8.15a3.21 3.21 0 1 1 0-6.42 3.21 3.21 0 0 1 0 6.42zm5.13-9.5a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3z',
};

/** Free-tool pills shown above the footer on every marketing page. */
export async function QuickLinks() {
  const t = await getTranslations('Marketing');
  return (
    <div className="border-mk-border bg-mk-bg-alt border-t">
      <Container className="flex flex-wrap items-center gap-2 py-5">
        <span className="text-mk-heading mr-2 text-sm font-semibold">
          {t('quickLinks.label')}:
        </span>
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={toolHref(tool.slug)}
            className="border-mk-soft2 text-mk-heading hover:border-mk-primary hover:text-mk-primary-hover rounded-full border bg-white px-3.5 py-1.5 text-sm font-medium"
          >
            {t(`tools.items.${tool.key}.name`)}
          </Link>
        ))}
        <Link
          href="/tools"
          className="text-mk-primary-hover hover:bg-mk-soft rounded-full px-3.5 py-1.5 text-sm font-semibold"
        >
          {t('tools.all')} →
        </Link>
      </Container>
    </div>
  );
}

function Column({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-mk-heading text-sm font-semibold">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="text-mk-body hover:text-mk-primary-hover text-sm"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const t = await getTranslations('Marketing');
  const year = new Date().getFullYear();
  return (
    <footer
      className="border-mk-border border-t bg-white"
      aria-labelledby="mk-footer-heading"
    >
      <h2 id="mk-footer-heading" className="sr-only">
        {brand.name}
      </h2>
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Logo />
            <p className="text-mk-body mt-4 max-w-xs text-sm">
              {t('footer.tagline')}
            </p>
            <ul className="text-mk-body mt-4 space-y-1.5 text-sm">
              <li>
                <a
                  href={`mailto:${brand.contact.email}`}
                  className="hover:text-mk-primary-hover"
                >
                  {brand.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${brand.contact.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-mk-primary-hover"
                >
                  WhatsApp {brand.contact.whatsappDisplay}
                </a>
              </li>
            </ul>
            <ul className="mt-5 flex gap-2" aria-label={t('footer.social')}>
              {brand.social.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="border-mk-border text-mk-body hover:border-mk-primary hover:text-mk-primary-hover inline-flex h-9 w-9 items-center justify-center rounded-full border"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d={SOCIAL_ICONS[s.id]} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Column
            title={t('footer.product')}
            links={FEATURE_SLUGS.map((s) => ({
              href: `/features/${s}`,
              label: t(`nav.features.${s}.title`),
            }))}
          />
          <Column
            title={t('footer.solutions')}
            links={SOLUTION_SLUGS.map((s) => ({
              href: `/solutions/${s}`,
              label: t(`nav.solutionItems.${s}.title`),
            }))}
          />
          <Column
            title={t('footer.freeTools')}
            links={[
              ...TOOLS.map((tool) => ({
                href: toolHref(tool.slug),
                label: t(`tools.items.${tool.key}.name`),
              })),
              { href: '/tools', label: t('tools.all') },
            ]}
          />
          <div className="space-y-10">
            <Column
              title={t('footer.resources')}
              links={RESOURCES.filter((r) => r.key !== 'contact').map((r) => ({
                href: r.href,
                label: t(`nav.resourceItems.${r.key}`),
              }))}
            />
            <Column
              title={t('footer.company')}
              links={COMPANY.map((c) => ({
                href: c.href,
                label: t(`nav.companyItems.${c.key}`),
              }))}
            />
          </div>
        </div>

        <div className="border-mk-border text-mk-muted mt-12 flex flex-col gap-4 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.name}. {t('footer.rights')}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-mk-primary-hover">
                  {t(`nav.legalItems.${l.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-mk-muted mt-4 text-xs">{t('footer.disclaimer')}</p>
      </Container>
    </footer>
  );
}
