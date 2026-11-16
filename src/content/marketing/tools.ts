/**
 * Free tools: drives the navbar dropdown, footer column, quick-links row,
 * home strip and the /tools hub. Text lives in messages (Marketing.tools).
 * Tool pages are built in the next marketing step; `available` gates links.
 */
export interface MarketingTool {
  slug: string;
  /** i18n key under Marketing.tools.items.<key> */
  key: 'linkGenerator' | 'qrGenerator' | 'textFormatter' | 'chatWidget';
  icon: 'link' | 'qr' | 'format' | 'widget';
}

export const TOOLS: MarketingTool[] = [
  { slug: 'whatsapp-link-generator', key: 'linkGenerator', icon: 'link' },
  { slug: 'whatsapp-qr-code-generator', key: 'qrGenerator', icon: 'qr' },
  { slug: 'whatsapp-text-formatter', key: 'textFormatter', icon: 'format' },
  { slug: 'whatsapp-widget', key: 'chatWidget', icon: 'widget' },
];

export const toolHref = (slug: string) => `/tools/${slug}`;
