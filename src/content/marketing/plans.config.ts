/**
 * Marketing pricing plans: the ONLY place plan data lives for the public
 * site (home pricing preview + /pricing). Phase 3 (billing) replaces this
 * file's contents with the plans API; the shape is kept stable for that.
 *
 * PRICES ARE PLACEHOLDERS: every plan is `comingSoon: true` and shows
 * "Coming soon" instead of a number. Set real amounts in MINOR units
 * (paise / cents) and flip `comingSoon` to false when pricing is final.
 */
export type BillingInterval = 'monthly' | 'yearly';

export interface MarketingPlan {
  id: 'free' | 'growth' | 'pro' | 'business';
  /** i18n key under Marketing.plans.<id> for name / description / cta */
  messageKey: string;
  /** Price per month in minor units for each interval; null = not set. */
  priceMinor: Record<BillingInterval, number | null>;
  currency: 'INR' | 'USD';
  comingSoon: boolean;
  mostPopular?: boolean;
  /** i18n keys under Marketing.plans.features.* shown as bullets. */
  featureKeys: string[];
}

export const PLANS: MarketingPlan[] = [
  {
    id: 'free',
    messageKey: 'free',
    priceMinor: { monthly: null, yearly: null },
    currency: 'INR',
    comingSoon: true,
    featureKeys: ['inbox', 'contacts', 'oneNumber', 'templates'],
  },
  {
    id: 'growth',
    messageKey: 'growth',
    priceMinor: { monthly: null, yearly: null },
    currency: 'INR',
    comingSoon: true,
    featureKeys: ['everythingFree', 'broadcasts', 'automations', 'pipelines'],
  },
  {
    id: 'pro',
    messageKey: 'pro',
    priceMinor: { monthly: null, yearly: null },
    currency: 'INR',
    comingSoon: true,
    mostPopular: true,
    featureKeys: ['everythingGrowth', 'flows', 'aiAssistant', 'apiWebhooks'],
  },
  {
    id: 'business',
    messageKey: 'business',
    priceMinor: { monthly: null, yearly: null },
    currency: 'INR',
    comingSoon: true,
    featureKeys: ['everythingPro', 'multiNumber', 'roles', 'prioritySupport'],
  },
];

/** Yearly discount shown on the toggle (placeholder until billing). */
export const YEARLY_DISCOUNT_LABEL_KEY = 'yearlyHint';

/** Formats a minor-unit price, or null when the plan has no price yet. */
export function formatPlanPrice(
  plan: MarketingPlan,
  interval: BillingInterval,
  locale = 'en-IN'
): string | null {
  const minor = plan.priceMinor[interval];
  if (plan.comingSoon || minor == null) return null;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
