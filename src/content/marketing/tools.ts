/**
 * Free tools: drives the navbar dropdown, footer column, quick-links row,
 * home strip, the /tools hub and each /tools/<slug> page. Names and short
 * descriptions live in messages (Marketing.tools.items); the page copy
 * below is English.
 */
import type { Qa, Step } from './pages';

export interface MarketingTool {
  slug: string;
  /** i18n key under Marketing.tools.items.<key> */
  key: 'linkGenerator' | 'qrGenerator' | 'textFormatter' | 'chatWidget';
  icon: 'link' | 'qr' | 'format' | 'widget';
  title: string;
  subtitle: string;
  metaDescription: string;
  steps: Step[];
  faq: Qa[];
}

export const TOOLS: MarketingTool[] = [
  {
    slug: 'whatsapp-link-generator',
    key: 'linkGenerator',
    icon: 'link',
    title: 'Free WhatsApp link generator',
    subtitle:
      'Create a wa.me click-to-chat link with an optional pre-filled message, plus a QR code. Free, no sign-up, nothing leaves your browser.',
    metaDescription:
      'Free WhatsApp link generator: create a wa.me click-to-chat link with a pre-filled message and QR code in seconds. No sign-up.',
    steps: [
      {
        title: 'Enter your number',
        desc: 'Pick your country code and type your WhatsApp number.',
      },
      {
        title: 'Add a message',
        desc: 'Optionally write the message customers will see pre-typed.',
      },
      {
        title: 'Share the link',
        desc: 'Copy it into your website, bio, emails or ads, or download the QR code.',
      },
    ],
    faq: [
      {
        q: 'What is a wa.me link?',
        a: 'It is WhatsApp’s official click-to-chat link. Anyone who opens it starts a chat with your number, without saving it as a contact first.',
      },
      {
        q: 'Does it work with WhatsApp Business?',
        a: 'Yes. It works with the WhatsApp app, the WhatsApp Business app and numbers on the WhatsApp Business Platform.',
      },
      {
        q: 'Do you store my number?',
        a: 'No. The link is built in your browser; nothing is sent to our servers.',
      },
    ],
  },
  {
    slug: 'whatsapp-qr-code-generator',
    key: 'qrGenerator',
    icon: 'qr',
    title: 'Free WhatsApp QR code generator',
    subtitle:
      'Make a QR code that opens a WhatsApp chat with you, in your brand colours and with your logo in the middle. Download as PNG or SVG, no watermark.',
    metaDescription:
      'Free WhatsApp QR code generator with custom colours and logo. Download high-resolution PNG or SVG with no watermark.',
    steps: [
      {
        title: 'Enter your number',
        desc: 'Or switch to “Any link or text” to encode a website or note.',
      },
      {
        title: 'Make it yours',
        desc: 'Choose colours and add your logo to the centre.',
      },
      {
        title: 'Download and print',
        desc: 'Save as PNG or SVG for menus, packaging, posters and shop counters.',
      },
    ],
    faq: [
      {
        q: 'Will the QR code expire?',
        a: 'No. It encodes your link directly, so it keeps working for as long as your number does.',
      },
      {
        q: 'Does adding a logo break the code?',
        a: 'The code uses high error correction when a logo is added, so it still scans. Always test with your phone before printing.',
      },
      {
        q: 'Which format should I print?',
        a: 'SVG scales to any size without blurring and is best for print. PNG is fine for screens and social media.',
      },
    ],
  },
  {
    slug: 'whatsapp-text-formatter',
    key: 'textFormatter',
    icon: 'format',
    title: 'Free WhatsApp text formatter',
    subtitle:
      'Write bold, italic, strikethrough, monospace, lists and quotes the way WhatsApp understands them, and see a live preview before you copy.',
    metaDescription:
      'Free WhatsApp text formatter: bold, italic, strikethrough, monospace, lists and quotes with a live WhatsApp preview. Copy and paste anywhere.',
    steps: [
      {
        title: 'Type or paste',
        desc: 'Write your message, offer or announcement.',
      },
      {
        title: 'Select and style',
        desc: 'Highlight words and click bold, italic, strike, code or list.',
      },
      {
        title: 'Copy into WhatsApp',
        desc: 'Copy the text and paste it into a chat, a broadcast or a template.',
      },
    ],
    faq: [
      {
        q: 'Which formats does WhatsApp support?',
        a: '*bold*, _italic_, ~strikethrough~, ```monospace```, `inline code`, bulleted and numbered lists and > quotes.',
      },
      {
        q: 'Why isn’t my text turning bold?',
        a: 'The symbols must touch the text: *word* works, * word * does not.',
      },
      {
        q: 'Can I use this in message templates?',
        a: 'Yes. WhatsApp templates support the same bold, italic, strikethrough and monospace formatting.',
      },
    ],
  },
  {
    slug: 'whatsapp-widget',
    key: 'chatWidget',
    icon: 'widget',
    title: 'Free WhatsApp chat button for your website',
    subtitle:
      'Add a floating WhatsApp button with a friendly greeting to any website. Customise it, preview it live and copy one snippet. No plugin needed.',
    metaDescription:
      'Free WhatsApp chat widget for websites: floating click-to-chat button with greeting, custom colour and position. One copy-paste snippet, no tracking.',
    steps: [
      {
        title: 'Customise',
        desc: 'Set your number, greeting, colour and which corner it sits in.',
      },
      {
        title: 'Copy the code',
        desc: 'One self-contained snippet, no account or plugin.',
      },
      {
        title: 'Paste on your site',
        desc: 'Add it before </body>, or in WordPress, Shopify or Wix custom code.',
      },
    ],
    faq: [
      {
        q: 'Does the widget slow down my website?',
        a: 'No. It is a tiny inline script with no external files, fonts or trackers.',
      },
      {
        q: 'Does it work on WordPress, Shopify and Wix?',
        a: 'Yes. Paste the snippet wherever your platform lets you add custom HTML or code to every page.',
      },
      {
        q: 'Does it set cookies?',
        a: 'No. It only opens a WhatsApp chat when the visitor clicks it.',
      },
    ],
  },
];

export const toolHref = (slug: string) => `/tools/${slug}`;
export const findTool = (slug: string) => TOOLS.find((t) => t.slug === slug);
