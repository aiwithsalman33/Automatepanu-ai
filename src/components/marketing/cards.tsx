/**
 * Server-rendered marketing building blocks: FeatureCard, StatTile,
 * ToolCard, FaqAccordion (native <details>: zero JS, keyboard accessible),
 * LogoMarquee, CtaBand.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronDown, Code2, Link2, QrCode, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingLogo } from '@/content/marketing/logos';
import { Badge, Container, MkButton } from './primitives';

export function FeatureCard({
  title,
  desc,
  visual,
  badge,
  className,
}: {
  title: string;
  desc: string;
  visual?: ReactNode;
  badge?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mk-lift border-mk-border shadow-mk flex flex-col rounded-2xl border bg-white p-6',
        className
      )}
    >
      {visual && (
        <div className="bg-mk-bg-alt2 mb-5 rounded-xl p-4">{visual}</div>
      )}
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        {badge && <Badge tone="outline">{badge}</Badge>}
      </div>
      <p className="text-mk-body mt-2 text-sm">{desc}</p>
    </div>
  );
}

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-mk-border shadow-mk rounded-2xl border bg-white p-6 text-center">
      <p className="text-mk-primary text-4xl font-extrabold tracking-tight">
        {value}
      </p>
      <p className="text-mk-body mt-2 text-sm">{label}</p>
    </div>
  );
}

const TOOL_ICONS = {
  link: Link2,
  qr: QrCode,
  format: Type,
  widget: Code2,
} as const;

export function ToolCard({
  href,
  name,
  desc,
  icon,
  cta,
}: {
  href: string;
  name: string;
  desc: string;
  icon: keyof typeof TOOL_ICONS;
  cta: string;
}) {
  const Icon = TOOL_ICONS[icon];
  return (
    <Link
      href={href}
      className="mk-lift group border-mk-border shadow-mk flex flex-col rounded-2xl border bg-white p-6"
    >
      <span className="bg-mk-soft text-mk-primary-hover inline-flex h-11 w-11 items-center justify-center rounded-xl">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-bold">{name}</h3>
      <p className="text-mk-body mt-1 flex-1 text-sm">{desc}</p>
      <span className="text-mk-primary-hover mt-4 text-sm font-semibold group-hover:underline">
        {cta} →
      </span>
    </Link>
  );
}

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-mk-border border-mk-border mx-auto max-w-3xl divide-y rounded-2xl border bg-white">
      {items.map((it) => (
        <details key={it.q} className="group px-5 py-1 sm:px-6">
          <summary className="text-mk-heading flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown
              aria-hidden
              className="text-mk-primary h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="text-mk-body pb-5">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export function LogoMarquee({
  title,
  logos,
  placeholderLabel,
}: {
  title: string;
  logos: MarketingLogo[];
  placeholderLabel: string;
}) {
  const row = [...logos, ...logos]; // duplicated for a seamless loop
  return (
    <div className="border-mk-border border-y bg-white py-10">
      <Container>
        <p className="text-mk-muted text-center text-sm font-semibold">
          {title}
        </p>
      </Container>
      <div className="mk-marquee relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <ul className="mk-marquee-track flex w-max gap-10">
          {row.map((logo, i) => (
            <li
              key={i}
              aria-hidden={i >= logos.length}
              className="flex h-12 w-40 items-center justify-center"
            >
              {logo.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo.src}
                  alt={logo.name}
                  className="max-h-10 w-auto opacity-70 grayscale"
                />
              ) : (
                <span
                  title={placeholderLabel}
                  className="border-mk-soft2 text-mk-muted flex h-10 w-36 items-center justify-center rounded-lg border border-dashed text-xs font-semibold"
                >
                  {logo.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CtaBand({
  title,
  subtitle,
  primary,
  secondary,
}: {
  title: string;
  subtitle: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <section className="bg-mk-bg py-16 sm:py-20" aria-labelledby="mk-cta-title">
      <Container>
        <div className="shadow-mk-lg relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#4c1d95] px-6 py-14 text-center sm:px-12">
          {/* Soft glows as radial gradients: same look as blur filters
              without their paint cost on low-end phones. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.18),transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,rgba(232,121,249,0.25),transparent)]"
          />
          <h2
            id="mk-cta-title"
            className="relative text-3xl font-extrabold !text-white sm:text-4xl"
          >
            {title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-violet-100">
            {subtitle}
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <MkButton href={primary.href} variant="white" size="lg">
              {primary.label}
            </MkButton>
            <MkButton href={secondary.href} variant="outlineWhite" size="lg">
              {secondary.label}
            </MkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
