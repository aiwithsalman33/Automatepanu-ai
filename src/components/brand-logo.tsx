import Image from 'next/image';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/** Intrinsic size of public/brand/logo*.png (wide lockup). */
const FULL = { width: 1200, height: 317 } as const;

type Tone = 'auto' | 'light' | 'dark';

/**
 * The full Automate logo (mark + wordmark + "WhatsApp Automation").
 *
 * The wordmark's dark ink disappears on dark surfaces, so there are two
 * files: `logo.png` (light surfaces) and `logo-white.png` (dark surfaces).
 *   tone="light" → always the dark-ink file (marketing site, emails)
 *   tone="dark"  → always the white-ink file
 *   tone="auto"  → follows the app's light/dark mode (`data-mode` on
 *                  <html>; see .brand-logo-* in globals.css)
 *
 * Size it with a height class (e.g. `h-9`); width follows the aspect ratio.
 */
export function BrandLogo({
  className,
  tone = 'auto',
  priority = false,
}: {
  className?: string;
  tone?: Tone;
  priority?: boolean;
}) {
  const img = (src: string, extra?: string) => (
    <Image
      src={src}
      alt={brand.name}
      width={FULL.width}
      height={FULL.height}
      priority={priority}
      className={cn('h-9 w-auto select-none', className, extra)}
      draggable={false}
    />
  );
  if (tone === 'light') return img(brand.logo.full);
  if (tone === 'dark') return img(brand.logo.fullOnDark);
  return (
    <>
      {img(brand.logo.full, 'brand-logo-light')}
      {img(brand.logo.fullOnDark, 'brand-logo-dark')}
    </>
  );
}

/** The square icon on its own (no wordmark). Size with `h-* w-*`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={brand.logo.mark}
      alt=""
      aria-hidden
      width={512}
      height={512}
      className={cn('h-9 w-9 shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
