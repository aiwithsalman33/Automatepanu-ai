import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * The brand mark as inline SVG (same drawing as public/brand/logo-mark.svg)
 * plus an HTML wordmark set in the site font, so it stays crisp and
 * themeable without an extra request.
 */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={cn('h-9 w-9 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="mk-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient
          id="mk-logo-ink"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="70"
          x2="0"
          y2="170"
        >
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="60" fill="url(#mk-logo-bg)" />
      <path
        fill="#fff"
        d="M88 50h80a40 40 0 0 1 40 40v56a40 40 0 0 1-40 40h-58l-34 26a6 6 0 0 1-9.6-5.6L72 186.4A40 40 0 0 1 48 146V90a40 40 0 0 1 40-40z"
      />
      <g
        stroke="url(#mk-logo-ink)"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M128 82 92 154M128 82l36 72" />
        <path d="M107 126h42" strokeWidth="11" />
      </g>
      <g fill="url(#mk-logo-ink)">
        <circle cx="128" cy="80" r="13" />
        <circle cx="91" cy="155" r="12" />
        <circle cx="165" cy="155" r="12" />
      </g>
      <circle cx="128" cy="80" r="5" fill="#fff" />
      <path
        fill="#A78BFA"
        d="M182 66c1.2 7 3.8 9.6 10.8 10.8-7 1.2-9.6 3.8-10.8 10.8-1.2-7-3.8-9.6-10.8-10.8 7-1.2 9.6-3.8 10.8-10.8z"
      />
    </svg>
  );
}

export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'text-lg font-extrabold tracking-tight',
          onDark ? 'text-white' : 'text-mk-heading'
        )}
      >
        {brand.shortName}
      </span>
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-xs font-extrabold',
          onDark ? 'text-mk-primary-hover bg-white' : 'bg-mk-primary text-white'
        )}
      >
        AI
      </span>
    </span>
  );
}
