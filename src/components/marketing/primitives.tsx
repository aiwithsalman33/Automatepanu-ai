/**
 * Marketing primitives: Container, Section, SectionHeader, Badge,
 * MkButton (link-styled buttons), JsonLd. Server components; tokens from
 * the `.mk` scope in globals.css (white + light purple, light only).
 */
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}
    >
      {children}
    </div>
  );
}

const SECTION_BG = {
  white: 'bg-mk-bg',
  alt: 'bg-mk-bg-alt',
  alt2: 'bg-mk-bg-alt2',
} as const;

export function Section({
  id,
  bg = 'white',
  className,
  children,
  labelledBy,
}: {
  id?: string;
  bg?: keyof typeof SECTION_BG;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(SECTION_BG[bg], 'py-16 sm:py-24', className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Badge({
  children,
  tone = 'soft',
  className,
}: {
  children: ReactNode;
  tone?: 'soft' | 'solid' | 'outline' | 'muted';
  className?: string;
}) {
  const tones = {
    soft: 'bg-mk-soft text-mk-primary-hover',
    solid: 'bg-mk-primary text-white',
    outline: 'border border-mk-soft2 bg-white text-mk-primary-hover',
    muted: 'bg-mk-bg-alt2 text-mk-muted',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div
      className={cn(
        'mb-12 max-w-3xl',
        align === 'center' ? 'mx-auto text-center' : ''
      )}
    >
      {eyebrow && <Badge>{eyebrow}</Badge>}
      <h2 id={id} className="mt-4 text-3xl font-extrabold sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="text-mk-body mt-4 text-lg">{subtitle}</p>}
    </div>
  );
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 whitespace-nowrap';
const BUTTON_VARIANTS = {
  primary: 'bg-mk-primary text-white shadow-mk hover:bg-mk-primary-hover',
  secondary:
    'border border-mk-soft2 bg-white text-mk-heading hover:border-mk-primary hover:text-mk-primary-hover',
  ghost: 'text-mk-heading hover:bg-mk-soft hover:text-mk-primary-hover',
  white: 'bg-white text-mk-primary-hover hover:bg-mk-soft',
  outlineWhite: 'border border-white/60 text-white hover:bg-white/10',
} as const;
const BUTTON_SIZES = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
} as const;

export function mkButtonClass(
  variant: keyof typeof BUTTON_VARIANTS = 'primary',
  size: keyof typeof BUTTON_SIZES = 'md',
  className?: string
) {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  );
}

/** Link styled as a button. External/app URLs render a plain <a>. */
export function MkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'a'>, 'href'>) {
  const cls = mkButtonClass(variant, size, className);
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

/** Structured data. `<` is escaped so content can't close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

/** App URLs for Sign in / Start free (NEXT_PUBLIC_APP_URL, else same host). */
export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}
