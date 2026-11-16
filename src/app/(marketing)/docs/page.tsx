import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { PageHero, Prose } from '@/components/marketing/page-blocks';
import { appUrl, Container } from '@/components/marketing/primitives';

export const metadata: Metadata = {
  title: 'Getting started guide',
  description:
    'Set up Automate step by step: connect your WhatsApp number, invite your team, import contacts, create templates, automations, flows and the AI assistant.',
  alternates: { canonical: '/docs' },
};

const SECTIONS = [
  ['account', 'Create your account'],
  ['connect', 'Connect your WhatsApp number'],
  ['team', 'Invite your team'],
  ['contacts', 'Import contacts'],
  ['templates', 'Create message templates'],
  ['broadcasts', 'Send a broadcast'],
  ['automations', 'Automate replies'],
  ['ai', 'Set up the AI assistant'],
  ['api', 'API and webhooks'],
] as const;

export default function DocsPage() {
  const webhook = `${brand.urls.app}/api/whatsapp/webhook`;
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Resources' }, { label: 'Getting started' }]}
        eyebrow="Documentation"
        title="Getting started guide"
        subtitle="Everything you need to go from sign-up to your first automated WhatsApp conversation."
        actions={false}
      />
      <section className="bg-mk-bg pb-20">
        <Container className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-24 space-y-2 text-sm">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-mk-body hover:text-mk-primary-hover"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Prose>
            <h2 id="account">1. Create your account</h2>
            <p>
              <a href={appUrl('/signup')}>Sign up</a> with your email and
              confirm it from the link we send you. A workspace is created for
              you automatically; you are its owner.
            </p>

            <h2 id="connect">2. Connect your WhatsApp number</h2>
            <p>
              Automate uses Meta’s official WhatsApp Business Cloud API, so
              you need a Meta Business account and a Meta developer app with
              the WhatsApp product added.
            </p>
            <ol>
              <li>
                In Meta for Developers, open your app → WhatsApp → API Setup
                and add your phone number. Note the <strong>Phone number ID</strong>{' '}
                and <strong>WhatsApp Business Account ID</strong>.
              </li>
              <li>
                Create a permanent access token for a system user with the{' '}
                <code>whatsapp_business_messaging</code> and{' '}
                <code>whatsapp_business_management</code> permissions.
              </li>
              <li>
                In Automate, go to <strong>Settings → WhatsApp</strong>, paste
                the IDs and the token, choose a <strong>Webhook Verify Token</strong>{' '}
                (any secret string you make up) and save. Tokens are stored
                encrypted.
              </li>
              <li>
                In Meta → WhatsApp → Configuration, set the webhook URL to{' '}
                <code>{webhook}</code>, enter the same verify token and subscribe
                to the <code>messages</code> field.
              </li>
            </ol>
            <p>
              Send a WhatsApp message to your number: it should appear in the
              inbox within seconds.
            </p>

            <h2 id="team">3. Invite your team</h2>
            <p>
              In <strong>Settings → Team members</strong>, create an invite link and
              choose a role: <strong>admin</strong> (manages settings and
              team), <strong>agent</strong> (replies to chats) or{' '}
              <strong>viewer</strong> (read-only). Each teammate signs in with
              their own email.
            </p>

            <h2 id="contacts">4. Import contacts</h2>
            <p>
              Contacts are created automatically when someone messages you. To
              bring an existing list, open <strong>Contacts</strong>, click{' '}
              <strong>Import</strong>
              and upload a CSV with a phone column (international format).
              Add tags and custom fields to segment them later.
            </p>

            <h2 id="templates">5. Create message templates</h2>
            <p>
              To message someone who hasn’t written to you in the last 24
              hours, WhatsApp requires a Meta-approved template. Create one in{' '}
              <strong>Settings → Templates</strong>, add variables like{' '}
              <code>{'{{1}}'}</code> for the customer’s name and submit it.
              Approval usually takes minutes to a few hours.
            </p>

            <h2 id="broadcasts">6. Send a broadcast</h2>
            <p>
              Pick an approved template, choose an audience by tags or fields
              (or upload a CSV) and send. Follow delivered, read, replied and
              failed per recipient. Only message people who agreed to hear
              from you.
            </p>

            <h2 id="automations">7. Automate replies</h2>
            <p>
              <strong>Automations</strong> react to events (a keyword, a first
              message, a new contact, a tag) and run steps such as sending a
              message, waiting, checking a condition, tagging or calling a
              webhook. <strong>Flows</strong> are interactive chatbot menus
              with buttons and lists that collect answers and hand over to a
              person.
            </p>

            <h2 id="ai">8. Set up the AI assistant</h2>
            <p>
              In <strong>AI Agents</strong>, add an OpenAI, Anthropic or
              OpenAI-compatible API key and fill the knowledge base with your
              FAQs and policies. Agents then get one-click drafts in the inbox;
              you can also enable auto-reply with a per-chat limit.
            </p>

            <h2 id="api">9. API and webhooks</h2>
            <p>
              Create a scoped API key in <strong>Settings → API keys</strong> to
              send messages and manage contacts from your own systems, and add
              webhook URLs to receive events. See{' '}
              <Link href="/features/api">API &amp; webhooks</Link>.
            </p>

            <h2 id="help">Need help?</h2>
            <p>
              <Link href="/contact">Contact us</Link> and we’ll help you get
              set up.
            </p>
          </Prose>
        </Container>
      </section>
    </>
  );
}
