/**
 * Public changelog entries ("What's new" strip on the home page and the
 * /changelog page). Newest first. Only list things that have shipped.
 * Summaries are taken from CHANGELOG.md.
 */
export interface ChangelogEntry {
  version: string;
  /** ISO date */
  date: string;
  title: string;
  summary: string;
  tag: 'New' | 'Improved' | 'Fixed';
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.8.1',
    date: '2026-07-10',
    title: 'One thread per contact, always',
    summary:
      'Inbound messages can no longer split one customer across duplicate chats.',
    tag: 'Fixed',
  },
  {
    version: '0.8.0',
    date: '2026-07-08',
    title: 'AI auto-reply with real handoff',
    summary:
      'See which replies the AI sent, take over or resume from the thread, and hand off with a summary note.',
    tag: 'New',
  },
  {
    version: '0.6.0',
    date: '2026-07-02',
    title: 'AI knowledge base',
    summary:
      'Teach the assistant your FAQs, policies and product docs so it answers from your own content.',
    tag: 'New',
  },
  {
    version: '0.4.0',
    date: '2026-07-01',
    title: 'Outbound webhooks',
    summary:
      'Get signed events for new messages, status updates and new conversations in your own systems.',
    tag: 'New',
  },
];
