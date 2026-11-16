'use client';

/**
 * Client islands for the marketing site: scroll reveal, pricing toggle,
 * use-case tabs. Everything else on the page is a server component.
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
import {
  formatPlanPrice,
  PLANS,
  type BillingInterval,
} from '@/content/marketing/plans.config';
import { appUrl, mkButtonClass } from './primitives';

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

export function PricingPreview() {
  const t = useTranslations('Marketing');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const intervals = ['monthly', 'yearly'] as const;
  const onKey = useTablistKeys(intervals, interval, setInterval);

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <div
          role="tablist"
          aria-label={t('pricing.intervalLabel')}
          onKeyDown={onKey}
          className="border-mk-border inline-flex rounded-full border bg-white p-1"
        >
          {intervals.map((iv) => (
            <button
              key={iv}
              type="button"
              role="tab"
              data-tab={iv}
              aria-selected={interval === iv}
              tabIndex={interval === iv ? 0 : -1}
              onClick={() => setInterval(iv)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                interval === iv
                  ? 'bg-mk-primary text-white'
                  : 'text-mk-body hover:text-mk-heading'
              )}
            >
              {t(`pricing.${iv}`)}
            </button>
          ))}
        </div>
        <p className="text-mk-muted text-sm">{t('pricing.yearlyHint')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const price = formatPlanPrice(plan, interval);
          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-white p-6',
                plan.mostPopular
                  ? 'border-mk-primary shadow-mk-lg'
                  : 'border-mk-border shadow-mk'
              )}
            >
              {plan.mostPopular && (
                <span className="bg-mk-primary absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold text-white">
                  {t('pricing.mostPopular')}
                </span>
              )}
              <h3 className="text-lg font-extrabold">
                {t(`plans.${plan.messageKey}.name`)}
              </h3>
              <p className="text-mk-body mt-1 min-h-[3rem] text-sm">
                {t(`plans.${plan.messageKey}.description`)}
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                {price ? (
                  <>
                    <span className="text-mk-heading text-3xl font-extrabold">
                      {price}
                    </span>
                    <span className="text-mk-muted text-sm">
                      {t('pricing.perMonth')}
                    </span>
                  </>
                ) : (
                  <span className="bg-mk-bg-alt2 text-mk-primary-hover rounded-full px-3 py-1 text-sm font-bold">
                    {t('pricing.comingSoon')}
                  </span>
                )}
              </div>
              <p className="text-mk-muted mt-1 text-xs">
                {interval === 'monthly'
                  ? t('pricing.billedMonthly')
                  : t('pricing.billedYearly')}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.featureKeys.map((k) => (
                  <li key={k} className="text-mk-body flex gap-2 text-sm">
                    <Check
                      aria-hidden
                      className="text-mk-primary mt-0.5 h-4 w-4 shrink-0"
                    />
                    {t(`plans.features.${k}`)}
                  </li>
                ))}
              </ul>
              <a
                href={
                  plan.id === 'business'
                    ? '/contact?topic=sales'
                    : appUrl('/signup')
                }
                className={mkButtonClass(
                  plan.mostPopular ? 'primary' : 'secondary',
                  'md',
                  'mt-6 w-full'
                )}
              >
                {t(`plans.${plan.messageKey}.cta`)}
              </a>
            </div>
          );
        })}
      </div>
      <p className="text-mk-muted mt-6 text-center text-sm">
        {t('pricing.comingSoonNote')}
      </p>
    </div>
  );
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
