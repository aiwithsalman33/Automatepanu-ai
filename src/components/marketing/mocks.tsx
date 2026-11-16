/**
 * CSS/SVG product mocks (no stock photos). Purely decorative: every mock
 * is aria-hidden, and the surrounding headings/text carry the meaning.
 * WhatsApp green (--mk-wa) is used only inside these mocks.
 */
import {
  Bot,
  CheckCheck,
  Clock,
  Megaphone,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroMockLabels {
  inboxLabel: string;
  open: string;
  contactName: string;
  contactTag: string;
  msgIn1: string;
  msgOut1: string;
  msgIn2: string;
  aiBadge: string;
  aiDraft: string;
  assignedTo: string;
  windowLeft: string;
  cardDeal: string;
  cardBroadcast: string;
  cardFlow: string;
}

function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'bg-mk-soft text-mk-primary-hover inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        className
      )}
    >
      {initials}
    </span>
  );
}

function BubbleIn({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-mk-heading max-w-[80%] self-start rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm shadow-sm">
      {children}
    </div>
  );
}

function BubbleOut({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-mk-heading max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2 text-sm shadow-sm">
      {children}
      <CheckCheck
        className="ml-1 inline h-3.5 w-3.5 text-sky-500"
        aria-hidden
      />
    </div>
  );
}

export function HeroInboxMock({ l }: { l: HeroMockLabels }) {
  const chats = [
    { i: 'PS', n: l.contactName, active: true },
    { i: 'RK', n: 'Rahul K.' },
    { i: 'AM', n: 'Anita M.' },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-140">
      <div className="border-mk-border shadow-mk-lg overflow-hidden rounded-2xl border bg-white">
        {/* window bar */}
        <div className="border-mk-border bg-mk-bg-alt flex items-center gap-1.5 border-b px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="text-mk-muted ml-3 text-xs font-semibold">
            {l.inboxLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
          {/* list */}
          <ul className="border-mk-border hidden border-r bg-white p-2 sm:block">
            {chats.map((c) => (
              <li
                key={c.i}
                className={cn(
                  'flex items-center gap-2 rounded-xl p-2',
                  c.active && 'bg-mk-bg-alt2'
                )}
              >
                <Avatar initials={c.i} />
                <span className="min-w-0 flex-1">
                  <span className="text-mk-heading block truncate text-xs font-semibold">
                    {c.n}
                  </span>
                  <span className="bg-mk-border block h-1.5 w-16 rounded" />
                </span>
                {c.active && <span className="bg-mk-wa h-2 w-2 rounded-full" />}
              </li>
            ))}
          </ul>
          {/* thread */}
          <div className="flex min-h-75 flex-col bg-[#efeae2]">
            <div className="flex items-center gap-2 border-b border-black/5 bg-white px-3 py-2">
              <Avatar initials="PS" className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="text-mk-heading truncate text-xs font-semibold">
                  {l.contactName}
                </p>
                <p className="text-mk-muted flex items-center gap-1 text-[10px]">
                  <Clock className="h-3 w-3" /> {l.windowLeft}
                </p>
              </div>
              <span className="bg-mk-soft text-mk-primary-hover rounded-full px-2 py-0.5 text-[10px] font-semibold">
                {l.contactTag}
              </span>
              <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline">
                {l.open}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <BubbleIn>{l.msgIn1}</BubbleIn>
              <BubbleOut>{l.msgOut1}</BubbleOut>
              <BubbleIn>{l.msgIn2}</BubbleIn>
              <div className="border-mk-soft2 mt-auto rounded-xl border bg-white p-2.5">
                <span className="bg-mk-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                  <Sparkles className="h-3 w-3" /> {l.aiBadge}
                </span>
                <p className="text-mk-heading mt-1.5 text-xs">{l.aiDraft}</p>
              </div>
              <p className="text-mk-muted flex items-center gap-1.5 text-[10px]">
                <Avatar initials="AR" className="h-4 w-4 text-[8px]" />{' '}
                {l.assignedTo}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* floating mini-cards */}
      <div className="mk-float border-mk-border text-mk-heading shadow-mk absolute bottom-20 -left-8 hidden rounded-xl border bg-white px-3 py-2 text-xs font-semibold md:block">
        <span className="bg-mk-primary mr-1.5 inline-block h-2 w-2 rounded-full" />
        {l.cardDeal}
      </div>
      <div
        className="mk-float border-mk-border text-mk-heading shadow-mk absolute -top-5 -right-6 hidden items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold md:flex"
        style={{ animationDelay: '1.5s' }}
      >
        <Megaphone className="text-mk-primary h-3.5 w-3.5" /> {l.cardBroadcast}
      </div>
      <div
        className="mk-float border-mk-border text-mk-heading shadow-mk absolute right-10 -bottom-6 hidden items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold md:flex"
        style={{ animationDelay: '3s' }}
      >
        <Workflow className="text-mk-primary h-3.5 w-3.5" /> {l.cardFlow}
      </div>
    </div>
  );
}

/* ----------------------------- bento minis ----------------------------- */

const bar = 'h-2 rounded bg-mk-border';

export function MiniMock({ kind }: { kind: string }) {
  switch (kind) {
    case 'inbox':
      return (
        <div aria-hidden className="space-y-2">
          {['PS', 'RK', 'AM'].map((i, n) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm"
            >
              <Avatar initials={i} className="h-6 w-6 text-[9px]" />
              <span className={cn(bar, 'flex-1')} />
              <span
                className={cn(
                  'h-5 w-5 rounded-full text-center text-[9px] leading-5 font-bold',
                  n === 0
                    ? 'bg-mk-primary text-white'
                    : 'bg-mk-soft text-mk-primary-hover'
                )}
              >
                {n === 0 ? '2' : 'A'}
              </span>
            </div>
          ))}
        </div>
      );
    case 'contacts':
      return (
        <div
          aria-hidden
          className="space-y-1.5 rounded-lg bg-white p-2 shadow-sm"
        >
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className="bg-mk-soft h-5 w-5 rounded-full" />
              <span className={cn(bar, 'w-16')} />
              <span className="bg-mk-soft text-mk-primary-hover ml-auto rounded-full px-1.5 text-[9px] font-semibold">
                {['VIP', 'Lead', 'CSV'][r]}
              </span>
            </div>
          ))}
        </div>
      );
    case 'pipelines':
      return (
        <div aria-hidden className="grid grid-cols-3 gap-1.5">
          {[2, 3, 1].map((n, c) => (
            <div key={c} className="space-y-1.5 rounded-lg bg-white/70 p-1.5">
              <span className={cn(bar, 'bg-mk-soft2 block w-8')} />
              {Array.from({ length: n }, (_, k) => (
                <span
                  key={k}
                  className={cn(
                    'block h-5 rounded-md bg-white shadow-sm',
                    c === 1 && k === 0 && 'ring-mk-primary ring-2'
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      );
    case 'broadcasts':
      return (
        <div
          aria-hidden
          className="space-y-1.5 rounded-lg bg-white p-2 shadow-sm"
        >
          {[
            ['Sent', 100],
            ['Delivered', 96],
            ['Read', 81],
          ].map(([k, v]) => (
            <div
              key={k}
              className="text-mk-muted flex items-center gap-2 text-[9px] font-semibold"
            >
              <span className="w-12">{k}</span>
              <span className="bg-mk-bg-alt2 h-2 flex-1 overflow-hidden rounded">
                <span
                  className="bg-mk-primary block h-full rounded"
                  style={{ width: `${v}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      );
    case 'automations':
      return (
        <div
          aria-hidden
          className="flex items-center gap-1.5 text-[9px] font-semibold"
        >
          {['Keyword', 'Wait 1h', 'Tag'].map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'rounded-md px-2 py-1.5 shadow-sm',
                  i === 0
                    ? 'bg-mk-primary text-white'
                    : 'text-mk-heading bg-white'
                )}
              >
                {s}
              </span>
              {i < 2 && <span className="bg-mk-soft2 h-px w-3" />}
            </span>
          ))}
        </div>
      );
    case 'flows':
      return (
        <div
          aria-hidden
          className="text-mk-heading flex flex-col items-center gap-1 text-[9px] font-semibold"
        >
          <span className="bg-mk-primary rounded-md px-2 py-1 text-white">
            Welcome
          </span>
          <span className="bg-mk-soft2 h-2 w-px" />
          <div className="flex gap-1.5">
            {['Pricing', 'Support', 'Agent'].map((b) => (
              <span
                key={b}
                className="rounded-md bg-white px-1.5 py-1 shadow-sm"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      );
    case 'ai':
      return (
        <div
          aria-hidden
          className="border-mk-soft2 rounded-lg border bg-white p-2 shadow-sm"
        >
          <span className="bg-mk-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white">
            <Bot className="h-2.5 w-2.5" /> AI
          </span>
          <span className={cn(bar, 'mt-1.5 block w-full')} />
          <span className={cn(bar, 'mt-1 block w-2/3')} />
        </div>
      );
    case 'multiNumber':
      return (
        <div aria-hidden className="space-y-1.5">
          {['+91 98… · Sales', '+91 97… · Support'].map((n, i) => (
            <div
              key={n}
              className="text-mk-heading flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[9px] font-semibold shadow-sm"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  i === 0 ? 'bg-mk-wa' : 'bg-mk-primary'
                )}
              />{' '}
              {n}
            </div>
          ))}
        </div>
      );
    case 'api':
      return (
        <pre
          aria-hidden
          className="bg-mk-heading text-mk-soft2 overflow-hidden rounded-lg p-2 text-[9px] leading-relaxed"
        >
          {'POST /api/v1/messages\n{ "to": "+91…",\n  "type": "text" }'}
        </pre>
      );
    default:
      return null;
  }
}

/* -------------------------- deep-dive visuals -------------------------- */

export function DeepDiveVisual({
  kind,
}: {
  kind: 'inbox' | 'automations' | 'ai' | 'broadcasts';
}) {
  const frame = 'rounded-2xl border border-mk-border bg-white p-5 shadow-mk';
  if (kind === 'inbox') {
    return (
      <div aria-hidden className={frame}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {['AR', 'MK', 'SJ'].map((i) => (
              <span key={i} className="relative">
                <Avatar initials={i} className="ring-2 ring-white" />
                <span className="bg-mk-wa absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" />
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> 21h left
          </span>
        </div>
        <div className="space-y-2 rounded-xl bg-[#efeae2] p-3">
          <BubbleIn>Can I change my delivery address?</BubbleIn>
          <BubbleOut>Of course — send me the new one 👍</BubbleOut>
        </div>
        <div className="border-mk-soft2 bg-mk-bg-alt text-mk-body mt-3 rounded-xl border border-dashed p-3 text-xs">
          📝 Internal note: customer is a repeat buyer — offer free shipping.
        </div>
      </div>
    );
  }
  if (kind === 'automations') {
    return (
      <div aria-hidden className={frame}>
        <div className="flex flex-col items-center gap-2 text-xs font-semibold">
          <span className="bg-mk-primary shadow-mk rounded-xl px-4 py-2 text-white">
            Keyword: “price”
          </span>
          <span className="bg-mk-soft2 h-4 w-px" />
          <span className="border-mk-border text-mk-heading rounded-xl border bg-white px-4 py-2">
            Send buttons
          </span>
          <span className="bg-mk-soft2 h-4 w-px" />
          <div className="grid w-full grid-cols-3 gap-2">
            {['Plans', 'Demo', 'Talk to us'].map((b) => (
              <span
                key={b}
                className="bg-mk-bg-alt2 text-mk-heading rounded-lg px-2 py-2 text-center"
              >
                {b}
              </span>
            ))}
          </div>
          <span className="bg-mk-soft2 h-4 w-px" />
          <span className="border-mk-border text-mk-heading rounded-xl border bg-white px-4 py-2">
            Tag “Hot lead” → Assign
          </span>
        </div>
      </div>
    );
  }
  if (kind === 'ai') {
    return (
      <div aria-hidden className={frame}>
        <div className="space-y-2 rounded-xl bg-[#efeae2] p-3">
          <BubbleIn>Do you ship to Coimbatore?</BubbleIn>
        </div>
        <div className="border-mk-soft2 mt-3 rounded-xl border bg-white p-3">
          <span className="bg-mk-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white">
            <Sparkles className="h-3 w-3" /> AI draft · from your knowledge base
          </span>
          <p className="text-mk-heading mt-2 text-sm">
            Yes! We deliver to Coimbatore in 2–4 working days. Want the tracking
            link once it ships?
          </p>
          <div className="mt-3 flex gap-2 text-xs font-semibold">
            <span className="bg-mk-primary rounded-full px-3 py-1 text-white">
              Send
            </span>
            <span className="border-mk-border text-mk-heading rounded-full border px-3 py-1">
              Edit
            </span>
          </div>
        </div>
        <p className="text-mk-muted mt-3 text-xs">
          Provider: your own key · OpenAI / Anthropic / compatible
        </p>
      </div>
    );
  }
  return (
    <div aria-hidden className={frame}>
      <p className="text-mk-heading text-sm font-bold">
        Diwali offer · template
      </p>
      <p className="text-mk-muted mt-1 text-xs">
        Hi {'{{1}}'}, your exclusive code is {'{{2}}'} 🎉
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          ['Sent', '2,400'],
          ['Delivered', '2,310'],
          ['Read', '1,960'],
          ['Replied', '312'],
        ].map(([k, v]) => (
          <div key={k} className="bg-mk-bg-alt rounded-xl p-2">
            <p className="text-mk-heading text-sm font-extrabold">{v}</p>
            <p className="text-mk-muted text-[10px] font-semibold">{k}</p>
          </div>
        ))}
      </div>
      <p className="text-mk-muted mt-3 text-[10px]">Illustrative numbers</p>
    </div>
  );
}
