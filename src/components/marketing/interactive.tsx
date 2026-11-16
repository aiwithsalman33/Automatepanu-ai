'use client';

/**
 * Client islands for the marketing site: scroll reveal and use-case
 * tabs. Everything else on the page is a server component.
 */
import { useTranslations } from 'next-intl';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Fade/slide in when scrolled into view — progressive enhancement.
 *
 * Content is VISIBLE in the server HTML (crawlers, no-JS, slow devices
 * and the first paint all see it). After hydration, only elements that
 * are still below the viewport are hidden and then revealed as they
 * scroll in, so nothing the visitor has already seen ever disappears.
 * Driven through a data attribute (no React state, no re-render).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    el.dataset.state = 'hidden';
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.state = 'shown';
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn('mk-reveal', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Arrow-key navigation for an ARIA tablist (roving tabindex). */
function useTablistKeys<T extends string>(
  ids: readonly T[],
  active: T,
  setActive: (id: T) => void
) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ids.indexOf(active);
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    setActive(ids[next]);
    (
      e.currentTarget.querySelector(
        `[data-tab="${ids[next]}"]`
      ) as HTMLElement | null
    )?.focus();
  };
}

const USE_CASES = [
  'sales',
  'support',
  'agencies',
  'ecommerce',
  'education',
] as const;
type UseCase = (typeof USE_CASES)[number];

export function UseCaseTabs() {
  const t = useTranslations('Marketing');
  const [active, setActive] = useState<UseCase>('sales');
  const onKey = useTablistKeys(USE_CASES, active, setActive);

  return (
    <div>
      <div
        role="tablist"
        aria-label={t('useCases.title')}
        onKeyDown={onKey}
        className="mx-auto mb-8 flex max-w-full gap-2 overflow-x-auto pb-1 sm:justify-center"
      >
        {USE_CASES.map((id) => (
          <button
            key={id}
            id={`mk-uc-tab-${id}`}
            type="button"
            role="tab"
            data-tab={id}
            aria-selected={active === id}
            aria-controls={`mk-uc-panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            onClick={() => setActive(id)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              active === id
                ? 'border-mk-primary bg-mk-primary text-white'
                : 'border-mk-border text-mk-body hover:border-mk-soft2 hover:text-mk-heading bg-white'
            )}
          >
            {t(`useCases.tabs.${id}.label`)}
          </button>
        ))}
      </div>
      {USE_CASES.map((id) => (
        <div
          key={id}
          id={`mk-uc-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`mk-uc-tab-${id}`}
          hidden={active !== id}
          className="border-mk-border shadow-mk mx-auto max-w-3xl rounded-2xl border bg-white p-6 sm:p-10"
        >
          <h3 className="text-2xl font-extrabold">
            {t(`useCases.tabs.${id}.title`)}
          </h3>
          <p className="text-mk-body mt-3">{t(`useCases.tabs.${id}.body`)}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {(['a', 'b', 'c'] as const).map((p) => (
              <li
                key={p}
                className="bg-mk-bg-alt text-mk-heading flex gap-2 rounded-xl p-3 text-sm"
              >
                <Check
                  aria-hidden
                  className="text-mk-primary mt-0.5 h-4 w-4 shrink-0"
                />
                {t(`useCases.tabs.${id}.points.${p}`)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
