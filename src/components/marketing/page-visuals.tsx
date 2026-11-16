/**
 * Hero mockups for feature/solution pages that have no deep-dive visual
 * on the home page. Decorative (aria-hidden), illustrative content only.
 */
import { Bot, Check, GitBranch, KeyRound, MessageSquare, UsersRound } from 'lucide-react';

const frame = 'rounded-2xl border border-mk-border bg-white p-5 shadow-mk';

export function PipelineVisual() {
  const cols = [
    { name: 'New lead', color: 'bg-sky-400', deals: [['Priya S.', '₹18,000'], ['Rahul K.', '₹9,500']] },
    { name: 'Proposal', color: 'bg-amber-400', deals: [['Anita M.', '₹42,000']], active: true },
    { name: 'Won', color: 'bg-emerald-500', deals: [['Vikram R.', '₹27,000'], ['Sara J.', '₹12,000']] },
  ];
  return (
    <div aria-hidden className={frame}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-mk-heading text-sm font-bold">Sales pipeline</p>
        <span className="bg-mk-soft text-mk-primary-hover rounded-full px-2.5 py-1 text-xs font-semibold">
          This month
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.name} className="bg-mk-bg-alt2 rounded-xl p-2.5">
            <p className="text-mk-heading mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${c.color}`} /> {c.name}
            </p>
            <div className="space-y-2">
              {c.deals.map(([n, v]) => (
                <div
                  key={n}
                  className={`rounded-lg bg-white p-2 shadow-sm ${c.active ? 'ring-mk-primary ring-2' : ''}`}
                >
                  <p className="text-mk-heading text-xs font-semibold">{n}</p>
                  <p className="text-mk-muted mt-0.5 flex items-center gap-1 text-[11px]">
                    <MessageSquare className="h-3 w-3" /> {v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-mk-muted mt-3 text-[11px]">Illustrative data</p>
    </div>
  );
}

export function FlowVisual() {
  return (
    <div aria-hidden className={frame}>
      <p className="text-mk-heading mb-4 flex items-center gap-2 text-sm font-bold">
        <GitBranch className="text-mk-primary h-4 w-4" /> Welcome menu flow
      </p>
      <div className="space-y-3">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[#f0f2f5] px-3.5 py-2.5 text-sm text-[#111b21]">
          Hi! 👋 What can we help you with today?
        </div>
        <div className="flex max-w-[80%] flex-col gap-1.5">
          {['📦 Track my order', '🛍️ Browse products', '🙋 Talk to a person'].map((b, i) => (
            <span
              key={b}
              className={`rounded-xl border px-3 py-2 text-center text-sm font-medium ${i === 1 ? 'border-mk-primary bg-mk-soft text-mk-primary-hover' : 'border-mk-border text-[#027eb5]'}`}
            >
              {b}
            </span>
          ))}
        </div>
        <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-2.5 text-sm text-[#111b21]">
          🛍️ Browse products
        </div>
        <div className="border-mk-soft2 text-mk-body flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs">
          <Check className="h-3.5 w-3.5 text-emerald-600" /> Saved to contact field{' '}
          <code className="bg-mk-bg-alt2 rounded px-1">interest = products</code>
        </div>
      </div>
    </div>
  );
}

export function ApiVisual() {
  return (
    <div aria-hidden className={frame}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-mk-heading flex items-center gap-2 text-sm font-bold">
          <KeyRound className="text-mk-primary h-4 w-4" /> REST API
        </p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          201 Created
        </span>
      </div>
      <pre className="overflow-hidden rounded-xl bg-[#0f172a] p-4 text-[12px] leading-5 text-slate-200">
        <code>
          <span className="text-violet-300">POST</span> /api/v1/messages{'\n'}
          <span className="text-slate-400">Authorization: Bearer wacrm_live_…</span>
          {'\n\n'}
          {'{'}
          {'\n'}  <span className="text-sky-300">&quot;to&quot;</span>: <span className="text-emerald-300">&quot;+919876543210&quot;</span>,
          {'\n'}  <span className="text-sky-300">&quot;type&quot;</span>: <span className="text-emerald-300">&quot;template&quot;</span>,
          {'\n'}  <span className="text-sky-300">&quot;template&quot;</span>: {'{'}
          {'\n'}    <span className="text-sky-300">&quot;name&quot;</span>: <span className="text-emerald-300">&quot;order_shipped&quot;</span>,
          {'\n'}    <span className="text-sky-300">&quot;params&quot;</span>: [<span className="text-emerald-300">&quot;#4821&quot;</span>]
          {'\n'}  {'}'}
          {'\n'}
          {'}'}
        </code>
      </pre>
      <div className="border-mk-border text-mk-body mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
        <Bot className="text-mk-primary h-3.5 w-3.5" /> Webhook <code>message.received</code>{' '}
        delivered · signed
      </div>
    </div>
  );
}

export function WorkspaceVisual() {
  const people = [
    ['AR', 'Arun', 'Owner'],
    ['MK', 'Meera', 'Admin'],
    ['SJ', 'Sam', 'Agent'],
    ['CL', 'Client', 'Viewer'],
  ];
  return (
    <div aria-hidden className={frame}>
      <p className="text-mk-heading mb-4 flex items-center gap-2 text-sm font-bold">
        <UsersRound className="text-mk-primary h-4 w-4" /> Client workspace · Team
      </p>
      <ul className="space-y-2">
        {people.map(([i, n, r]) => (
          <li key={n} className="bg-mk-bg-alt2 flex items-center justify-between rounded-xl px-3 py-2.5">
            <span className="flex items-center gap-3">
              <span className="bg-mk-soft text-mk-primary-hover inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                {i}
              </span>
              <span className="text-mk-heading text-sm font-semibold">{n}</span>
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r === 'Viewer' ? 'bg-white text-mk-muted' : 'bg-mk-soft text-mk-primary-hover'}`}
            >
              {r}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-mk-muted mt-3 text-[11px]">Viewers can read chats but not send.</p>
    </div>
  );
}
