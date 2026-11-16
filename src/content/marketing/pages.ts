/**
 * Content for the feature (/features/<slug>) and solution
 * (/solutions/<slug>) pages. English; the navigation labels come from
 * messages (Marketing.nav.*). Every claim here describes what the
 * product does today; nothing is an invented metric.
 */
import type { FeatureSlug, SolutionSlug } from './nav';

export type IconName =
  | 'inbox'
  | 'users'
  | 'note'
  | 'clock'
  | 'zap'
  | 'tag'
  | 'send'
  | 'chart'
  | 'file'
  | 'filter'
  | 'bot'
  | 'sparkles'
  | 'book'
  | 'shield'
  | 'key'
  | 'webhook'
  | 'code'
  | 'list'
  | 'branch'
  | 'hand'
  | 'kanban'
  | 'bell'
  | 'globe'
  | 'cart'
  | 'school'
  | 'briefcase'
  | 'headset'
  | 'mic';

/** Which mockup the page hero shows (components/marketing/mocks.tsx). */
export type Visual =
  | { type: 'deep'; kind: 'inbox' | 'automations' | 'ai' | 'broadcasts' }
  | { type: 'mini'; kind: string };

export interface Point {
  icon: IconName;
  title: string;
  desc: string;
}
export interface Step {
  title: string;
  desc: string;
}
export interface Qa {
  q: string;
  a: string;
}

export interface FeaturePage {
  eyebrow: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  visual: Visual;
  highlights: Point[];
  steps: Step[];
  faq: Qa[];
  related: FeatureSlug[];
}

export interface SolutionPage {
  eyebrow: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  visual: Visual;
  problems: { title: string; desc: string }[];
  outcomes: Point[];
  journey: Step[];
  features: FeatureSlug[];
  faq: Qa[];
}

export const FEATURE_PAGES: Record<FeatureSlug, FeaturePage> = {
  inbox: {
    eyebrow: 'Shared team inbox',
    title: 'One WhatsApp number. Your whole team replying.',
    subtitle:
      'Stop passing one phone around. Every customer chat lands in one inbox where the right person picks it up, replies fast and leaves a trail the next person can follow.',
    metaDescription:
      'A shared WhatsApp inbox for teams: assign chats, internal notes, quick replies, templates and a live 24-hour reply-window timer on every conversation.',
    visual: { type: 'deep', kind: 'inbox' },
    highlights: [
      {
        icon: 'users',
        title: 'Assign and hand over',
        desc: 'Route each conversation to a teammate, see who is online and hand chats over without losing context.',
      },
      {
        icon: 'note',
        title: 'Internal notes',
        desc: 'Leave notes on a conversation that only your team can see. The customer never receives them.',
      },
      {
        icon: 'clock',
        title: '24-hour window timer',
        desc: 'Every chat shows how long you have left for a free-form reply, so nothing slips past WhatsApp’s window.',
      },
      {
        icon: 'zap',
        title: 'Quick replies and templates',
        desc: 'Answer common questions in one click and send Meta-approved templates when the window has closed.',
      },
      {
        icon: 'mic',
        title: 'Voice notes, media and reactions',
        desc: 'Record voice notes, send images and documents and react to messages, right from the browser.',
      },
      {
        icon: 'tag',
        title: 'Status, tags and filters',
        desc: 'Mark chats open, pending or resolved, tag them and filter the inbox to what needs attention now.',
      },
    ],
    steps: [
      {
        title: 'Connect your number',
        desc: 'Link your WhatsApp Business number through Meta’s official Cloud API in a few minutes.',
      },
      {
        title: 'Invite your team',
        desc: 'Send an invite link and give each person a role: owner, admin, agent or viewer.',
      },
      {
        title: 'Reply together',
        desc: 'Conversations appear in the shared inbox. Assign, reply and resolve as a team.',
      },
    ],
    faq: [
      {
        q: 'Can several people reply from the same number?',
        a: 'Yes. Everyone on your team works the same WhatsApp number from their own login, and every reply is recorded against the person who sent it.',
      },
      {
        q: 'What happens after the 24-hour window closes?',
        a: 'WhatsApp only allows free-form replies within 24 hours of the customer’s last message. After that the inbox lets you send an approved template to restart the conversation.',
      },
      {
        q: 'Can a teammate only read chats?',
        a: 'Yes. The viewer role can read conversations but cannot send messages.',
      },
    ],
    related: ['automations', 'ai-assistant', 'broadcasts'],
  },

  broadcasts: {
    eyebrow: 'Broadcasts',
    title: 'Campaigns that read like a one-to-one message.',
    subtitle:
      'Send Meta-approved templates to exactly the right customers, fill in each person’s details automatically and watch delivery and reads per recipient.',
    metaDescription:
      'WhatsApp broadcast campaigns with approved templates, audiences from tags, custom fields or CSV, personalised variables and per-recipient delivery and read tracking.',
    visual: { type: 'deep', kind: 'broadcasts' },
    highlights: [
      {
        icon: 'filter',
        title: 'Precise audiences',
        desc: 'Build an audience from tags, custom fields or a CSV upload instead of blasting everyone.',
      },
      {
        icon: 'sparkles',
        title: 'Personalised variables',
        desc: 'Template variables are filled from each contact’s name and fields, so every message feels written for them.',
      },
      {
        icon: 'chart',
        title: 'Per-recipient tracking',
        desc: 'See sent, delivered, read, replied and failed for every single recipient.',
      },
      {
        icon: 'file',
        title: 'Template manager',
        desc: 'Create templates with text, buttons and media headers and submit them to Meta for approval.',
      },
      {
        icon: 'send',
        title: 'Retry failures',
        desc: 'Resend to the recipients that failed without messaging the ones who already received it.',
      },
      {
        icon: 'inbox',
        title: 'Replies land in the inbox',
        desc: 'When customers answer a campaign, the reply opens a normal conversation for your team.',
      },
    ],
    steps: [
      {
        title: 'Pick a template',
        desc: 'Choose an approved template or create a new one and submit it to Meta.',
      },
      {
        title: 'Choose the audience',
        desc: 'Filter contacts by tags or fields, or upload a CSV for a one-off list.',
      },
      {
        title: 'Send and measure',
        desc: 'Send now and follow delivery, reads and replies per recipient.',
      },
    ],
    faq: [
      {
        q: 'Why do broadcasts need approved templates?',
        a: 'WhatsApp only allows business-initiated messages through templates that Meta has approved. That keeps messaging opt-in and protects your number’s quality rating.',
      },
      {
        q: 'Can I upload my own contact list?',
        a: 'Yes. Upload a CSV; duplicates are detected and the contacts can be saved for later campaigns.',
      },
      {
        q: 'Do replies to a broadcast reach my team?',
        a: 'Yes. Every reply opens or continues a conversation in the shared inbox.',
      },
    ],
    related: ['inbox', 'automations', 'api'],
  },

  automations: {
    eyebrow: 'No-code automations',
    title: 'Let routine replies run themselves.',
    subtitle:
      'Answer first messages, follow up on leads and route chats with triggers, waits and conditions, all without writing code.',
    metaDescription:
      'No-code WhatsApp automations: keyword, first-message, new-contact and tag triggers with waits, conditions, tagging, deals and webhooks.',
    visual: { type: 'deep', kind: 'automations' },
    highlights: [
      {
        icon: 'zap',
        title: 'Triggers that matter',
        desc: 'Start on a keyword, a customer’s first message, a new contact or a tag being added.',
      },
      {
        icon: 'clock',
        title: 'Waits and timeouts',
        desc: 'Wait minutes, hours or days before the next step, perfect for follow-ups.',
      },
      {
        icon: 'branch',
        title: 'Conditions',
        desc: 'Branch on tags, fields or replies so each customer gets the right next step.',
      },
      {
        icon: 'tag',
        title: 'Tag, assign and create deals',
        desc: 'Automatically tag contacts, assign the chat and add a deal to your pipeline.',
      },
      {
        icon: 'webhook',
        title: 'Webhooks',
        desc: 'Send data to your own systems or tools like Sheets and CRMs at any step.',
      },
      {
        icon: 'chart',
        title: 'Run history',
        desc: 'See every run and every step, so you always know what the automation did.',
      },
    ],
    steps: [
      {
        title: 'Choose a trigger',
        desc: 'Pick what starts the automation, such as a keyword or a first message.',
      },
      {
        title: 'Add steps',
        desc: 'Send messages, wait, check conditions, tag, assign or call a webhook.',
      },
      {
        title: 'Switch it on',
        desc: 'Activate it and follow each run in the history.',
      },
    ],
    faq: [
      {
        q: 'Do I need to code?',
        a: 'No. Automations are built from triggers and steps in the app. Webhooks are optional for connecting your own tools.',
      },
      {
        q: 'What is the difference between automations and flows?',
        a: 'Automations react to events and run steps in the background. Flows are interactive chatbot conversations with buttons and lists that collect answers.',
      },
      {
        q: 'Can an automation hand over to a person?',
        a: 'Yes. A step can assign the conversation to a teammate, who then continues in the inbox.',
      },
    ],
    related: ['flows', 'ai-assistant', 'inbox'],
  },

  flows: {
    eyebrow: 'Visual chatbot flows',
    title: 'Chatbot menus your customers actually enjoy.',
    subtitle:
      'Design WhatsApp conversations with buttons and lists in a visual builder, collect answers into contact fields and hand off to a person whenever it matters.',
    metaDescription:
      'Visual WhatsApp chatbot flow builder with buttons, list menus, data collection into contact fields and clean human handoff.',
    visual: { type: 'mini', kind: 'flows' },
    highlights: [
      {
        icon: 'branch',
        title: 'Drag-and-drop builder',
        desc: 'Lay out the conversation visually and see every path at a glance.',
      },
      {
        icon: 'list',
        title: 'Buttons and list menus',
        desc: 'Use WhatsApp’s native reply buttons and list messages instead of “reply 1 for…”.',
      },
      {
        icon: 'file',
        title: 'Collect answers',
        desc: 'Ask for a name, email, city or anything else and save it to the contact’s fields.',
      },
      {
        icon: 'hand',
        title: 'Human handoff',
        desc: 'Hand the chat to your team at any point, with the answers already collected.',
      },
      {
        icon: 'clock',
        title: 'Timeouts',
        desc: 'Decide what happens when a customer stops replying mid-flow.',
      },
      {
        icon: 'zap',
        title: 'Start from keywords',
        desc: 'Launch a flow from a keyword, a first message or another automation.',
      },
    ],
    steps: [
      {
        title: 'Draw the conversation',
        desc: 'Add messages, buttons, lists and questions in the builder.',
      },
      {
        title: 'Decide the handoff',
        desc: 'Choose where a person takes over and which answers to save.',
      },
      {
        title: 'Publish',
        desc: 'Attach a trigger and the flow starts answering customers.',
      },
    ],
    faq: [
      {
        q: 'Is the flow builder available now?',
        a: 'Yes, flows are available in beta inside the app.',
      },
      {
        q: 'Where do collected answers go?',
        a: 'Into the contact’s custom fields, where your team, automations and broadcasts can use them.',
      },
      {
        q: 'Can customers still reach a person?',
        a: 'Yes. Add a handoff step anywhere; the conversation moves to the shared inbox.',
      },
    ],
    related: ['automations', 'ai-assistant', 'inbox'],
  },

  'ai-assistant': {
    eyebrow: 'AI reply assistant',
    title: 'AI that drafts in your voice, on your own key.',
    subtitle:
      'Get one-click reply drafts your agents can edit, or let an auto-reply bot answer from your knowledge base, with a clean handoff to people.',
    metaDescription:
      'AI reply drafts and optional auto-replies for WhatsApp using your own OpenAI, Anthropic or OpenAI-compatible key, answering from your knowledge base.',
    visual: { type: 'deep', kind: 'ai' },
    highlights: [
      {
        icon: 'sparkles',
        title: 'One-click drafts',
        desc: 'Generate a reply from the conversation; your agent edits and sends it.',
      },
      {
        icon: 'bot',
        title: 'Optional auto-reply',
        desc: 'Let the assistant answer by itself, with a per-chat cap so it never runs away.',
      },
      {
        icon: 'book',
        title: 'Knowledge base',
        desc: 'Add FAQs, policies and product details so answers come from your own information.',
      },
      {
        icon: 'key',
        title: 'Bring your own key',
        desc: 'Use OpenAI, Anthropic or any OpenAI-compatible model. The provider bills you directly.',
      },
      {
        icon: 'hand',
        title: 'Human handoff',
        desc: 'When the assistant is unsure or the customer asks for a person, your team takes over.',
      },
      {
        icon: 'shield',
        title: 'Encrypted keys',
        desc: 'Your AI keys are stored encrypted with AES-256-GCM and never shown again.',
      },
    ],
    steps: [
      {
        title: 'Add your AI key',
        desc: 'Paste an OpenAI, Anthropic or compatible key in AI settings.',
      },
      {
        title: 'Teach it your business',
        desc: 'Add your FAQs, policies and product details to the knowledge base.',
      },
      {
        title: 'Draft or auto-reply',
        desc: 'Use drafts in the inbox, or switch on auto-reply with limits.',
      },
    ],
    faq: [
      {
        q: 'Is there an AI fee per seat?',
        a: 'No. You use your own provider key and pay the provider directly for what you use.',
      },
      {
        q: 'Which models can I use?',
        a: 'OpenAI, Anthropic, or any provider with an OpenAI-compatible API, including self-hosted models.',
      },
      {
        q: 'Can I stop the bot replying?',
        a: 'Yes. Auto-reply is optional, capped per chat, and hands over to a person when needed.',
      },
    ],
    related: ['inbox', 'flows', 'automations'],
  },

  api: {
    eyebrow: 'API & webhooks',
    title: 'Connect WhatsApp to the rest of your stack.',
    subtitle:
      'Send messages and manage contacts from your own systems with a REST API, get signed webhooks for events, and let AI assistants work with your CRM over MCP.',
    metaDescription:
      'REST API with scoped, revocable keys, signed webhooks and an MCP server to connect WhatsApp conversations and contacts to your systems.',
    visual: { type: 'mini', kind: 'api' },
    highlights: [
      {
        icon: 'code',
        title: 'REST API',
        desc: 'Send template and text messages, and create or update contacts from your code.',
      },
      {
        icon: 'key',
        title: 'Scoped, revocable keys',
        desc: 'Create keys with only the permissions they need and revoke them any time.',
      },
      {
        icon: 'webhook',
        title: 'Signed webhooks',
        desc: 'Receive events like new messages and status updates, signed so you can verify them.',
      },
      {
        icon: 'bot',
        title: 'MCP server',
        desc: 'Let AI assistants read and act on your CRM data through the Model Context Protocol.',
      },
      {
        icon: 'cart',
        title: 'Store and app events',
        desc: 'Send order updates or reminders as approved templates when something happens in your system.',
      },
      {
        icon: 'shield',
        title: 'Isolated per account',
        desc: 'Every key is tied to one account and can only reach that account’s data.',
      },
    ],
    steps: [
      {
        title: 'Create a key',
        desc: 'In Settings, create an API key with the scopes you need.',
      },
      {
        title: 'Call the API',
        desc: 'Send messages or upsert contacts with a simple HTTPS request.',
      },
      {
        title: 'Listen for events',
        desc: 'Add a webhook URL and react to messages and status changes.',
      },
    ],
    faq: [
      {
        q: 'Can I send WhatsApp messages from my own app?',
        a: 'Yes. Use the REST API with a key that has the send scope. Outside the 24-hour window, send an approved template.',
      },
      {
        q: 'How do I verify webhooks?',
        a: 'Each webhook request is signed with a secret, so your server can confirm it came from us.',
      },
      {
        q: 'Can I limit what a key can do?',
        a: 'Yes. Keys are scoped to specific permissions and can be revoked instantly.',
      },
    ],
    related: ['broadcasts', 'automations', 'inbox'],
  },
};

export const SOLUTION_PAGES: Record<SolutionSlug, SolutionPage> = {
  sales: {
    eyebrow: 'For sales teams',
    title: 'Turn every WhatsApp enquiry into a tracked deal.',
    subtitle:
      'Leads message you on WhatsApp all day. Capture each one as a contact, move it through your pipeline and follow up automatically, so no lead goes cold in a chat.',
    metaDescription:
      'WhatsApp CRM for sales teams: capture leads, kanban pipelines linked to conversations, follow-up automations and segmented broadcasts.',
    visual: { type: 'mini', kind: 'pipelines' },
    problems: [
      {
        title: 'Leads lost in personal phones',
        desc: 'When sales chats live on one person’s phone, nobody else can follow up.',
      },
      {
        title: 'Follow-ups depend on memory',
        desc: 'Busy reps forget to check back, and warm leads go cold.',
      },
      {
        title: 'No view of the pipeline',
        desc: 'Managers can’t see which conversations are close to closing.',
      },
    ],
    outcomes: [
      {
        icon: 'kanban',
        title: 'Pipelines linked to chats',
        desc: 'Drag deals across stages and open the conversation behind each one.',
      },
      {
        icon: 'clock',
        title: 'Automatic follow-ups',
        desc: 'Automations wait and nudge leads who haven’t replied.',
      },
      {
        icon: 'tag',
        title: 'Segment leads',
        desc: 'Tags and custom fields let you target the right leads with the right offer.',
      },
      {
        icon: 'users',
        title: 'Team visibility',
        desc: 'Assign leads, see who is handling what and step in when needed.',
      },
    ],
    journey: [
      {
        title: 'A lead messages you',
        desc: 'The chat lands in the shared inbox and the contact is created.',
      },
      {
        title: 'Qualify it',
        desc: 'A flow asks a few questions and saves the answers to the contact.',
      },
      {
        title: 'Track the deal',
        desc: 'The rep adds a deal to the pipeline, linked to the conversation.',
      },
      {
        title: 'Follow up and close',
        desc: 'Automations remind silent leads; the rep closes the deal in the chat.',
      },
    ],
    features: ['inbox', 'automations', 'flows', 'broadcasts'],
    faq: [
      {
        q: 'Can each rep have their own leads?',
        a: 'Yes. Assign conversations to reps; everyone still works from one shared number.',
      },
      {
        q: 'Can I see deals by stage?',
        a: 'Yes. Pipelines show deals as a kanban board, each linked to its conversation.',
      },
      {
        q: 'Can I import my existing leads?',
        a: 'Yes. Import contacts from a CSV with tags and custom fields.',
      },
    ],
  },

  support: {
    eyebrow: 'For customer support',
    title: 'Faster answers, shared by the whole team.',
    subtitle:
      'Give customers quick, consistent help on the app they already use. Assign and prioritise chats, keep notes for colleagues and let AI handle the easy questions.',
    metaDescription:
      'WhatsApp customer support for teams: assignment, presence, internal notes, quick replies, AI auto-replies with human handoff.',
    visual: { type: 'deep', kind: 'inbox' },
    problems: [
      {
        title: 'Customers wait too long',
        desc: 'Without a shared queue, chats sit unanswered while the team is busy elsewhere.',
      },
      {
        title: 'The same questions, all day',
        desc: 'Agents type the same answers about hours, delivery and refunds again and again.',
      },
      {
        title: 'Context gets lost',
        desc: 'When a chat moves between people, the next person starts from zero.',
      },
    ],
    outcomes: [
      {
        icon: 'inbox',
        title: 'One shared queue',
        desc: 'Every chat in one inbox with status, assignment and filters.',
      },
      {
        icon: 'zap',
        title: 'Quick replies',
        desc: 'Common answers in one click, consistent across the team.',
      },
      {
        icon: 'bot',
        title: 'AI for the easy ones',
        desc: 'An optional auto-reply answers from your knowledge base and hands over when needed.',
      },
      {
        icon: 'note',
        title: 'Notes for colleagues',
        desc: 'Internal notes keep the full story with the conversation.',
      },
    ],
    journey: [
      {
        title: 'Customer asks for help',
        desc: 'The message arrives in the shared inbox with the 24-hour timer running.',
      },
      {
        title: 'AI answers the simple part',
        desc: 'If enabled, the assistant replies from your knowledge base.',
      },
      {
        title: 'An agent takes over',
        desc: 'Complex issues are assigned to the right person with notes attached.',
      },
      {
        title: 'Resolve and learn',
        desc: 'Mark it resolved and add the answer to quick replies or the knowledge base.',
      },
    ],
    features: ['inbox', 'ai-assistant', 'automations', 'flows'],
    faq: [
      {
        q: 'Can the AI answer without an agent?',
        a: 'Yes, if you switch on auto-reply. It is capped per chat and hands over to a person when needed.',
      },
      {
        q: 'Can agents see who else is online?',
        a: 'Yes. The inbox shows team presence and who each chat is assigned to.',
      },
      {
        q: 'Can we reply after 24 hours?',
        a: 'After the window closes you send an approved template; the inbox shows when that’s needed.',
      },
    ],
  },

  agencies: {
    eyebrow: 'For agencies',
    title: 'Run client WhatsApp with real control.',
    subtitle:
      'Manage WhatsApp for your clients with proper roles, separate workspaces and an API to connect the tools you already use.',
    metaDescription:
      'WhatsApp CRM for agencies: separate workspaces, owner/admin/agent/viewer roles, REST API and signed webhooks.',
    visual: { type: 'mini', kind: 'contacts' },
    problems: [
      {
        title: 'Shared passwords and phones',
        desc: 'Handing out one login or phone to every account manager is risky.',
      },
      {
        title: 'Clients want visibility',
        desc: 'Clients ask what was sent and how customers responded.',
      },
      {
        title: 'Disconnected tools',
        desc: 'Client data lives in CRMs, sheets and stores that WhatsApp can’t reach.',
      },
    ],
    outcomes: [
      {
        icon: 'users',
        title: 'Roles per person',
        desc: 'Owner, admin, agent and viewer roles: give clients read-only access if you want.',
      },
      {
        icon: 'briefcase',
        title: 'A workspace per client',
        desc: 'Each client gets its own workspace: number, contacts and campaigns fully isolated.',
      },
      {
        icon: 'code',
        title: 'API and webhooks',
        desc: 'Connect client systems with scoped keys and signed webhooks.',
      },
      {
        icon: 'chart',
        title: 'Campaign reporting',
        desc: 'Show delivery, reads and replies for every broadcast.',
      },
    ],
    journey: [
      {
        title: 'Create the client workspace',
        desc: 'Connect the client’s WhatsApp number to their own workspace.',
      },
      {
        title: 'Invite the team',
        desc: 'Add your account managers as agents and the client as a viewer.',
      },
      {
        title: 'Automate and campaign',
        desc: 'Set up flows, automations and broadcasts for the client.',
      },
      {
        title: 'Report results',
        desc: 'Share per-recipient campaign results and conversation history.',
      },
    ],
    features: ['inbox', 'broadcasts', 'api', 'automations'],
    faq: [
      {
        q: 'Can a client see their chats without replying?',
        a: 'Yes. Invite them with the viewer role: they can read but not send.',
      },
      {
        q: 'Can one login work in several client workspaces?',
        a: 'Each login belongs to one workspace, which keeps client data strictly apart. Use a separate email per client workspace.',
      },
      {
        q: 'Can we connect client tools?',
        a: 'Yes, through the REST API and signed webhooks.',
      },
    ],
  },

  ecommerce: {
    eyebrow: 'For e-commerce',
    title: 'From offer to order, right in the chat.',
    subtitle:
      'Reach shoppers on the app they read most. Send personalised offers, answer product questions instantly and keep customers updated after they buy.',
    metaDescription:
      'WhatsApp for e-commerce: personalised broadcast offers, chatbot menus for product questions and order updates from your store via the API.',
    visual: { type: 'deep', kind: 'broadcasts' },
    problems: [
      {
        title: 'Emails go unread',
        desc: 'Offers and updates sent by email are easy to miss.',
      },
      {
        title: 'Pre-sale questions pile up',
        desc: 'Shoppers ask about size, stock and delivery and leave if nobody answers.',
      },
      {
        title: 'Updates are manual',
        desc: 'Sending order and delivery updates by hand doesn’t scale.',
      },
    ],
    outcomes: [
      {
        icon: 'send',
        title: 'Personalised offers',
        desc: 'Broadcast approved templates with each shopper’s name and details.',
      },
      {
        icon: 'list',
        title: 'Instant answers',
        desc: 'Chatbot menus handle delivery, returns and sizing questions.',
      },
      {
        icon: 'cart',
        title: 'Order updates',
        desc: 'Send confirmations and delivery updates from your store via the API.',
      },
      {
        icon: 'bot',
        title: 'AI product help',
        desc: 'The assistant answers from your product information and hands over to people.',
      },
    ],
    journey: [
      {
        title: 'Announce an offer',
        desc: 'Broadcast a template to customers tagged by interest.',
      },
      {
        title: 'Answer questions',
        desc: 'A flow or the AI assistant replies about size, stock and delivery.',
      },
      {
        title: 'Confirm the order',
        desc: 'Your store calls the API to send the order confirmation.',
      },
      {
        title: 'Keep them updated',
        desc: 'Delivery updates and follow-ups go out automatically.',
      },
    ],
    features: ['broadcasts', 'flows', 'api', 'ai-assistant'],
    faq: [
      {
        q: 'Can my store send order updates automatically?',
        a: 'Yes. Call the REST API from your store or automation tool to send approved templates.',
      },
      {
        q: 'Can I target customers by interest?',
        a: 'Yes. Tag contacts and build broadcast audiences from tags and custom fields.',
      },
      {
        q: 'Do customers need to opt in?',
        a: 'Yes. WhatsApp requires customers to agree to receive messages from you before you send them templates.',
      },
    ],
  },

  education: {
    eyebrow: 'For education',
    title: 'Admissions and reminders that actually get read.',
    subtitle:
      'Answer enquiries from students and parents, collect their details automatically and send reminders about classes, fees and events.',
    metaDescription:
      'WhatsApp for schools, colleges and coaching centres: admission enquiry flows, a shared inbox for counsellors and broadcast reminders.',
    visual: { type: 'mini', kind: 'flows' },
    problems: [
      {
        title: 'Enquiries arrive all day',
        desc: 'Admission questions come in evenings and weekends when the office is closed.',
      },
      {
        title: 'Details get collected by hand',
        desc: 'Counsellors type the same questions to every enquiry.',
      },
      {
        title: 'Reminders get missed',
        desc: 'Notices about fees, classes and events are buried in group chats.',
      },
    ],
    outcomes: [
      {
        icon: 'list',
        title: 'Enquiry flows',
        desc: 'Collect course, name and contact details automatically.',
      },
      {
        icon: 'inbox',
        title: 'Shared inbox for counsellors',
        desc: 'Counsellors pick up enquiries with all the details already there.',
      },
      {
        icon: 'bell',
        title: 'Broadcast reminders',
        desc: 'Send fee, class and event reminders to exactly the right group.',
      },
      {
        icon: 'school',
        title: 'Organised contacts',
        desc: 'Tag students and parents by course, batch or year.',
      },
    ],
    journey: [
      {
        title: 'A parent enquires',
        desc: 'A flow greets them and asks which course they are interested in.',
      },
      {
        title: 'Details are saved',
        desc: 'Answers go straight into the contact’s fields.',
      },
      {
        title: 'A counsellor follows up',
        desc: 'The chat is assigned to a counsellor with everything already collected.',
      },
      {
        title: 'Keep families informed',
        desc: 'Broadcast reminders go to the right batch or year.',
      },
    ],
    features: ['flows', 'inbox', 'broadcasts', 'automations'],
    faq: [
      {
        q: 'Can we answer enquiries after hours?',
        a: 'Yes. A flow or the AI assistant can reply any time and collect details for the morning.',
      },
      {
        q: 'Can we message one batch only?',
        a: 'Yes. Tag contacts by course or batch and broadcast to that tag.',
      },
      {
        q: 'Is this better than WhatsApp groups?',
        a: 'Broadcasts are delivered privately to each person, so contacts don’t see each other’s numbers.',
      },
    ],
  },
};
