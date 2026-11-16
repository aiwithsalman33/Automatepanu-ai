/**
 * Building blocks for the inner marketing pages (features, solutions,
 * tools, resources, company, legal). Server components.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  ChartColumn,
  ChevronRight,
  Clock,
  Code2,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Hand,
  Headset,
  Inbox,
  KeyRound,
  Kanban,
  List,
  Mic,
  NotebookPen,
  School,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IconName, Point, Step, Visual } from '@/content/marketing/pages';
import { cn } from '@/lib/utils';
import { DeepDiveVisual, MiniMock } from './mocks';
import {
  ApiVisual,
  FlowVisual,
  PipelineVisual,
  WorkspaceVisual,
} from './page-visuals';
import { appUrl, Badge, Container, MkButton } from './primitives';

export const ICONS: Record<IconName, LucideIcon> = {
  inbox: Inbox,
  users: Users,
  note: NotebookPen,
  clock: Clock,
  zap: Zap,
  tag: Tag,
  send: Send,
  chart: ChartColumn,
  file: FileText,
  filter: Filter,
  bot: Bot,
  sparkles: Sparkles,
  book: BookOpen,
  shield: ShieldCheck,
  key: KeyRound,
  webhook: Webhook,
  code: Code2,
  list: List,
  branch: GitBranch,
  hand: Hand,
  kanban: Kanban,
  bell: Bell,
  globe: Globe,
  cart: ShoppingCart,
  school: School,
  briefcase: Briefcase,
  headset: Headset,
  mic: Mic,
};

export function Breadcrumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-mk-muted text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="hover:text-mk-primary-hover">
            Home
          </Link>
        </li>
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            {it.href ? (
              <Link href={it.href} className="hover:text-mk-primary-hover">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-mk-heading">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Page hero: text on the left, optional visual on the right. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  subtitle,
  visual,
  actions = true,
  children,
}: {
  crumbs: { href?: string; label: string }[];
  eyebrow?: string;
  title: string;
  subtitle?: string;
  visual?: ReactNode;
  actions?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="bg-mk-bg relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#ede9fe,transparent)]" />
      </div>
      <Container
        className={cn(
          'relative grid items-center gap-12 pt-10 pb-16 sm:pt-12 lg:pb-20',
          visual && 'lg:grid-cols-[1.05fr_1fr]'
        )}
      >
        <div className={cn(!visual && 'max-w-3xl')}>
          <Breadcrumbs items={crumbs} />
          {eyebrow && (
            <p className="text-mk-primary-hover mt-6 text-sm font-semibold tracking-wider uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{title}</h1>
          {subtitle && (
            <p className="text-mk-body mt-5 max-w-2xl text-lg">{subtitle}</p>
          )}
          {actions && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MkButton href={appUrl('/signup')} size="lg">
                Start free <ArrowRight aria-hidden className="h-4 w-4" />
              </MkButton>
              <MkButton href="/contact?topic=demo" variant="secondary" size="lg">
                Book a demo
              </MkButton>
            </div>
          )}
          {children}
        </div>
        {visual}
      </Container>
    </section>
  );
}

/** The mockup shown in a feature/solution hero. */
export function PageVisual({ visual }: { visual: Visual }) {
  if (visual.type === 'deep') return <DeepDiveVisual kind={visual.kind} />;
  if (visual.kind === 'pipelines') return <PipelineVisual />;
  if (visual.kind === 'flows') return <FlowVisual />;
  if (visual.kind === 'api') return <ApiVisual />;
  if (visual.kind === 'contacts') return <WorkspaceVisual />;
  return (
    <div className="border-mk-border shadow-mk-lg rounded-3xl border bg-white p-6">
      <div className="bg-mk-bg-alt2 rounded-2xl p-6 [&_*]:max-w-full">
        <div className="mx-auto max-w-sm origin-top scale-110 py-6">
          <MiniMock kind={visual.kind} />
        </div>
      </div>
    </div>
  );
}

export function PointGrid({
  points,
  columns = 3,
}: {
  points: Point[];
  columns?: 2 | 3 | 4;
}) {
  const cols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns];
  return (
    <div className={cn('grid gap-5', cols)}>
      {points.map((p) => {
        const Icon = ICONS[p.icon];
        return (
          <div
            key={p.title}
            className="mk-lift border-mk-border shadow-mk rounded-2xl border bg-white p-6"
          >
            <span className="bg-mk-soft text-mk-primary-hover inline-flex h-11 w-11 items-center justify-center rounded-xl">
              <Icon aria-hidden className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
            <p className="text-mk-body mt-2 text-sm">{p.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

export function Steps({ steps }: { steps: Step[] }) {
  const cols = steps.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  return (
    <ol className={cn('grid gap-5 sm:grid-cols-2', cols)}>
      {steps.map((s, i) => (
        <li
          key={s.title}
          className="border-mk-border relative rounded-2xl border bg-white p-6"
        >
          <span className="bg-mk-primary inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
            {i + 1}
          </span>
          <h3 className="mt-4 font-bold">{s.title}</h3>
          <p className="text-mk-body mt-2 text-sm">{s.desc}</p>
        </li>
      ))}
    </ol>
  );
}

/** Link cards to other pages (related features, other tools…). */
export function LinkCards({
  items,
}: {
  items: { href: string; title: string; desc: string }[];
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="mk-lift group border-mk-border shadow-mk rounded-2xl border bg-white p-6"
        >
          <h3 className="group-hover:text-mk-primary-hover font-bold">
            {it.title}
          </h3>
          <p className="text-mk-body mt-2 text-sm">{it.desc}</p>
          <span className="text-mk-primary-hover mt-4 inline-flex items-center gap-1 text-sm font-semibold">
            Learn more <ArrowRight aria-hidden className="h-4 w-4" />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Long-form text page body (legal, docs). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-mk-body [&_a]:text-mk-primary-hover [&_h2]:text-mk-heading [&_h3]:text-mk-heading max-w-3xl space-y-4 text-base leading-7 [&_a]:font-medium [&_a]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_strong]:text-mk-heading [&_ul]:list-disc [&_ul]:space-y-2">
      {children}
    </div>
  );
}

export { Badge };
