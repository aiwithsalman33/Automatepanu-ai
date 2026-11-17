"use client";

/**
 * /dev/ui-kit — every shared component in every state, on the app
 * surface tokens. A visual check without Storybook: open it under
 * `next dev`, tab through it, resize it. Not built for production
 * (see page.dev.tsx). Copy here is dev-only English on purpose.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Contact,
  Handshake,
  Inbox,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Command, CommandDialog, type CommandGroup } from "@/components/ui/command";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton, SkeletonCard, SkeletonRow, SkeletonText } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GALLERY_EXTRAS } from "./gallery-extras";

const SECTIONS = [
  "Tokens",
  "Buttons",
  "Badges & chips",
  "Avatars",
  "Form controls",
  "Cards & stat tiles",
  "Tabs & segmented",
  "Popover & drawer",
  "Command palette",
  "States",
  "Toast",
  ...GALLERY_EXTRAS.map((e) => e.title),
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={slug(title)} aria-labelledby={`${slug(title)}-h`} className="scroll-mt-6 space-y-4">
      <h2 id={`${slug(title)}-h`} className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const SWATCHES: [string, string][] = [
  ["--background", "Background"],
  ["--card-2", "Alt surface"],
  ["--muted", "Alt surface 2"],
  ["--border", "Border"],
  ["--input", "Control border"],
  ["--primary", "Primary"],
  ["--primary-hover", "Primary hover"],
  ["--primary-soft", "Soft"],
  ["--primary-soft-foreground", "Text on soft"],
  ["--foreground", "Text"],
  ["--muted-foreground", "Muted text"],
  ["--status-good", "Success (icons)"],
  ["--status-good-text", "Success text"],
  ["--status-warning", "Warning"],
  ["--status-warning-bg", "Warning bg"],
  ["--status-critical", "Danger"],
];

const SAMPLE_ITEMS = [
  { id: "c1", label: "Priya Sharma", hint: "+91 98450 12345", group: "Contacts", icon: <Contact /> },
  { id: "c2", label: "Rahul S", hint: "+91 90030 55555", group: "Contacts", icon: <Contact /> },
  { id: "m1", label: "Priya Sharma: “Is the order shipped?”", hint: "2m", group: "Chats", icon: <MessageSquare /> },
  { id: "d1", label: "Annual plan — Acme", hint: "Proposal", group: "Deals", icon: <Handshake /> },
  { id: "p1", label: "Home", hint: "Page", group: "Pages", icon: <LayoutDashboard /> },
  { id: "p2", label: "Inbox", hint: "Page", group: "Pages", icon: <Inbox /> },
  { id: "p3", label: "Contacts", hint: "Page", group: "Pages", icon: <Users /> },
];

function useSampleGroups(query: string, onPick: (label: string) => void): CommandGroup[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = SAMPLE_ITEMS.filter((i) => !q || i.label.toLowerCase().includes(q));
    const groups = ["Chats", "Contacts", "Deals", "Pages"];
    return groups.map((g) => ({
      id: g,
      label: g,
      items: items
        .filter((i) => i.group === g)
        .map((i) => ({ id: i.id, label: i.label, hint: i.hint, icon: i.icon, onSelect: () => onPick(i.label) })),
    }));
  }, [query, onPick]);
}

export function UiKitGallery() {
  const [chips, setChips] = useState({ all: true, unread: false, waiting: false });
  const [applied, setApplied] = useState(["VIP", "Acme Corp"]);
  const [range, setRange] = useState<"7" | "30" | "90">("7");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inlineQuery, setInlineQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = useMemo(() => (label: string) => {
    toast.info(`Selected “${label}”`);
    setPaletteOpen(false);
  }, []);
  const groups = useSampleGroups(query, pick);
  const inlineGroups = useSampleGroups(inlineQuery, pick);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <h1 className="text-base font-semibold">UI kit</h1>
          <span className="text-xs text-muted-foreground">dev only · app surface tokens</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[180px_1fr]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${slug(s)}`} className="block rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-12">
          <Section title="Tokens">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SWATCHES.map(([v, name]) => (
                <div key={v} className="overflow-hidden rounded-xl border border-border">
                  <div className="h-12" style={{ background: `var(${v})` }} />
                  <div className="px-3 py-2">
                    <div className="text-xs font-medium">{name}</div>
                    <code className="text-[11px] text-muted-foreground">{v}</code>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="rounded-xl bg-card p-4 shadow-soft">shadow-soft</div>
              <div className="rounded-xl bg-card p-4 shadow-card">shadow-card</div>
              <div className="rounded-xl bg-card p-4 shadow-pop">shadow-pop</div>
              <div className="rounded-lg border border-border p-4">radius lg (12px)</div>
              <div className="rounded-2xl border border-border p-4">radius 2xl (cards)</div>
            </div>
          </Section>

          <Section title="Buttons">
            <Row label="Variants">
              <Button>Primary</Button>
              <Button variant="soft">Soft</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button>
                <Plus /> With icon
              </Button>
            </Row>
            <Row label="States">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>
                Disabled outline
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setTimeout(() => setBusy(false), 1500);
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Send />} {busy ? "Sending…" : "Click: loading"}
              </Button>
            </Row>
            <Row label="Icon buttons">
              <IconButton label="Search" icon={<Search />} />
              <IconButton label="Notifications, 3 unread" icon={<Bell />} badge={3} />
              <IconButton label="Notifications, new" icon={<Bell />} badge />
              <IconButton label="Delete" icon={<Trash2 />} variant="destructive" />
              <IconButton label="Add" icon={<Plus />} variant="default" />
              <IconButton label="Small" icon={<Plus />} size="sm" variant="outline" />
              <IconButton label="Disabled" icon={<Plus />} disabled />
            </Row>
          </Section>

          <Section title="Badges & chips">
            <Row label="Badge">
              <Badge>Default</Badge>
              <Badge variant="soft">Soft</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Delivered</Badge>
              <Badge variant="warning">Window closing</Badge>
              <Badge variant="danger">Failed</Badge>
            </Row>
            <Row label="Toggle chips">
              {(["all", "unread", "waiting"] as const).map((k) => (
                <Chip key={k} selected={chips[k]} count={k === "unread" ? 4 : undefined} onSelectedChange={(on) => setChips((c) => ({ ...c, [k]: on }))}>
                  {k[0].toUpperCase() + k.slice(1)}
                </Chip>
              ))}
              <Chip selected={false} onSelectedChange={() => {}} disabled>
                Disabled
              </Chip>
            </Row>
            <Row label="Removable">
              {applied.map((a) => (
                <Chip key={a} icon={<Tag />} onRemove={() => setApplied((xs) => xs.filter((x) => x !== a))}>
                  {a}
                </Chip>
              ))}
              {applied.length === 0 ? (
                <Button size="sm" variant="ghost" onClick={() => setApplied(["VIP", "Acme Corp"])}>
                  Reset
                </Button>
              ) : null}
            </Row>
            <Row label="Static">
              <Chip>+91 98450 12345</Chip>
              <Chip selected>Selected (static)</Chip>
            </Row>
          </Section>

          <Section title="Avatars">
            <Row label="Sizes">
              <PersonAvatar name="Priya Sharma" size="xs" />
              <PersonAvatar name="Priya Sharma" size="sm" />
              <PersonAvatar name="Priya Sharma" size="md" />
              <PersonAvatar name="Priya Sharma" size="lg" />
            </Row>
            <Row label="Presence">
              <PersonAvatar name="Online Agent" presence="online" />
              <PersonAvatar name="Away Agent" presence="away" />
              <PersonAvatar name="Offline Agent" presence="offline" />
              <PersonAvatar name={null} />
            </Row>
          </Section>

          <Section title="Form controls">
            <div className="grid max-w-xl gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="kit-name">Name</Label>
                <Input id="kit-name" placeholder="Priya Sharma" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kit-bad">Invalid</Label>
                <Input id="kit-bad" aria-invalid defaultValue="not-an-email" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kit-off">Disabled</Label>
                <Input id="kit-off" disabled defaultValue="Read only" />
              </div>
              <div className="grid gap-1.5">
                <Label>Select</Label>
                <Select defaultValue="open">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kit-msg">Message</Label>
                <Textarea id="kit-msg" placeholder="Type a message" />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox defaultChecked /> Checkbox
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch defaultChecked /> Switch
                </label>
              </div>
            </div>
          </Section>

          <Section title="Cards & stat tiles">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>Thin border, soft purple shadow.</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground">Card body text.</CardContent>
              </Card>
              <StatTile
                label="New conversations"
                value="128"
                delta={{ label: "12%", direction: "up", tone: "good", srLabel: "better than last period" }}
                comparison="vs previous 7 days"
                spark={[4, 9, 7, 12, 10, 16, 18]}
              />
              <StatTile
                label="Median first reply"
                value="14"
                unit="min"
                delta={{ label: "8%", direction: "up", tone: "bad", srLabel: "worse than last period" }}
                comparison="vs previous 7 days"
                spark={[10, 12, 9, 14, null, 15, 14]}
              />
              <StatTile label="Deals won" value="0" delta={{ label: "—", direction: "flat", tone: "neutral" }} comparison="no comparison" spark={[0, 0, 0, 0]} />
              <StatTile label="Loading" value="" loading spark={[]} />
            </div>
            <Row label="Sparkline">
              <div className="w-40">
                <Sparkline values={[1, 3, 2, 5, 4, 7, 6]} />
              </div>
              <div className="w-40">
                <Sparkline values={[]} />
              </div>
            </Row>
          </Section>

          <Section title="Tabs & segmented">
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="activity" disabled>
                  Activity (disabled)
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="text-muted-foreground">Details panel</TabsContent>
              <TabsContent value="deals" className="text-muted-foreground">Deals panel</TabsContent>
              <TabsContent value="notes" className="text-muted-foreground">Notes panel</TabsContent>
            </Tabs>
            <Tabs defaultValue="all">
              <TabsList variant="line">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="waiting">Waiting</TabsTrigger>
                <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
              </TabsList>
            </Tabs>
            <Row label="Segmented">
              <SegmentedControl
                aria-label="Range"
                value={range}
                onValueChange={setRange}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                ]}
              />
              <SegmentedControl
                aria-label="Range (small)"
                size="sm"
                value={range}
                onValueChange={setRange}
                options={[
                  { value: "7", label: "7d" },
                  { value: "30", label: "30d" },
                  { value: "90", label: "90d", disabled: true },
                ]}
              />
            </Row>
          </Section>

          <Section title="Popover & drawer">
            <Row label="Popover">
              <Popover>
                <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
                <PopoverContent>
                  <PopoverHeader>
                    <PopoverTitle>Filters</PopoverTitle>
                    <PopoverDescription>Narrow the conversation list.</PopoverDescription>
                  </PopoverHeader>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected onSelectedChange={() => {}}>Window closing</Chip>
                    <Chip selected={false} onSelectedChange={() => {}}>Has tags</Chip>
                  </div>
                </PopoverContent>
              </Popover>
            </Row>
            <Row label="Drawer">
              <Drawer>
                <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
                <DrawerContent
                  title="Annual plan — Acme"
                  description="Proposal · ₹1,20,000"
                  footer={
                    <>
                      <DrawerClose render={<Button variant="ghost" />}>Cancel</DrawerClose>
                      <Button variant="outline">Mark lost</Button>
                      <Button>Mark won</Button>
                    </>
                  }
                >
                  <SkeletonText lines={6} />
                </DrawerContent>
              </Drawer>
              <Drawer>
                <DrawerTrigger render={<Button variant="outline" />}>Bottom sheet</DrawerTrigger>
                <DrawerContent side="bottom" title="More">
                  <p className="text-sm text-muted-foreground">Mobile “More” menu content.</p>
                </DrawerContent>
              </Drawer>
            </Row>
          </Section>

          <Section title="Command palette">
            <Row label="Dialog">
              <Button variant="outline" onClick={() => setPaletteOpen(true)}>
                <Search /> Open palette
              </Button>
            </Row>
            <Card className="max-w-xl gap-0 py-0">
              <Command
                query={inlineQuery}
                onQueryChange={setInlineQuery}
                groups={inlineGroups}
                placeholder="Search chats, contacts, deals, pages…"
                inputLabel="Search"
                emptyText="No matches"
                footer={<span>↑↓ to move · Enter to open · Esc to close</span>}
              />
            </Card>
            <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Search">
              <Command
                query={query}
                onQueryChange={setQuery}
                groups={groups}
                placeholder="Search chats, contacts, deals, pages…"
                inputLabel="Search"
                emptyText="No matches"
              />
            </CommandDialog>
          </Section>

          <Section title="States">
            <div className="grid gap-4 md:grid-cols-2">
              <EmptyState
                icon={Inbox}
                title="No conversations yet"
                description="New WhatsApp messages land here."
                action={
                  <Button size="sm">
                    <Plus /> New broadcast
                  </Button>
                }
              />
              <ErrorState onRetry={() => toast.info("Retrying…")} />
              <Card className="gap-0 py-0">
                <EmptyState compact title="Nothing here" description="Compact, inside a card." />
              </Card>
              <Card className="gap-0 py-0">
                <ErrorState compact onRetry={() => {}} />
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
              <span className="sr-only">Loading…</span>
              <Card className="gap-0 py-0">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </Card>
              <SkeletonCard />
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <SkeletonText />
              </div>
            </div>
          </Section>

          <Section title="Toast">
            <Row label="Sonner">
              <Button variant="outline" onClick={() => toast.success("Contact saved")}>Success</Button>
              <Button variant="outline" onClick={() => toast.error("Couldn't send the message")}>Error</Button>
              <Button variant="outline" onClick={() => toast.info("Broadcast scheduled")}>Info</Button>
              <Button
                variant="outline"
                onClick={() => toast("Deal moved to Won", { action: { label: "Undo", onClick: () => {} } })}
              >
                With action
              </Button>
            </Row>
          </Section>

          {GALLERY_EXTRAS.map((e) => (
            <Section key={e.title} title={e.title}>
              {e.render()}
            </Section>
          ))}
        </main>
      </div>
    </div>
  );
}
