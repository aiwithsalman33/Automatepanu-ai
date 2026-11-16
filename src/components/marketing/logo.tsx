import { BrandLogo, BrandMark } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

/** The square brand icon (public/brand/logo-mark-512.png). */
export function LogoMark({ className }: { className?: string }) {
  return <BrandMark className={className} />;
}

/** The full logo for the marketing site (light pages by default). */
export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <BrandLogo
      tone={onDark ? 'dark' : 'light'}
      priority
      className={cn('h-10 sm:h-11', className)}
    />
  );
}
