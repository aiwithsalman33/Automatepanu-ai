/**
 * "Trusted by growing teams" strip.
 *
 * PLACEHOLDERS — these are NOT customers. Replace each entry with a real
 * customer (with their permission) by setting `name` and `src` (an SVG or
 * PNG under public/brand/customers/). Never invent customer names.
 */
export interface MarketingLogo {
  name: string;
  /** null renders a neutral placeholder tile. */
  src: string | null;
  placeholder: boolean;
}

export const LOGOS: MarketingLogo[] = Array.from({ length: 8 }, (_, i) => ({
  name: `Your logo ${i + 1}`,
  src: null,
  placeholder: true,
}));
