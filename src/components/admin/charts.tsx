'use client';

/**
 * Admin panel charts, on the app's vendored Tremor BarChart (same
 * tooltip, axes and colors as the workspace dashboard). Teal-600 +
 * violet-500 is the dashboard's incoming/outgoing pair; validated for
 * both light and dark surfaces.
 */
import { useSyncExternalStore } from 'react';

import { BarChart } from '@/components/tremor/bar-chart';
import type { DayCount, DayMessages } from '@/lib/admin/queries';
import { fmtDay, fmtNumber } from '@/lib/admin/format';

/**
 * Recharts generates element ids and measures the container in the
 * browser, so its server HTML never matches the client's: a hydration
 * error that makes React re-render the whole root, which (among other
 * things) resets the theme attributes on <html>. These pages are server
 * rendered, so the charts render on the client only, behind a same-size
 * placeholder. (The workspace dashboard doesn't need this: it loads its
 * data after mount.)
 */
const subscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

function Placeholder({ className }: { className: string }) {
  return <div className={`${className} animate-pulse rounded-lg bg-muted/40`} aria-hidden />;
}

export function SignupsChart({ data }: { data: DayCount[] }) {
  const mounted = useMounted();
  if (!mounted) return <Placeholder className="h-60" />;
  const rows = data.map((d) => ({ label: fmtDay(d.day), 'New users': d.count }));
  return (
    <BarChart
      className="h-60"
      data={rows}
      index="label"
      categories={['New users']}
      colors={['violet']}
      yAxisWidth={32}
      showLegend={false}
      allowDecimals={false}
      valueFormatter={fmtNumber}
    />
  );
}

export function MessagesChart({
  data,
  className = 'h-60',
}: {
  data: DayMessages[];
  className?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Placeholder className={className} />;
  const rows = data.map((d) => ({
    label: fmtDay(d.day),
    Incoming: d.incoming,
    Outgoing: d.outgoing,
  }));
  return (
    <BarChart
      className={className}
      data={rows}
      index="label"
      categories={['Incoming', 'Outgoing']}
      colors={['teal', 'violet']}
      type="stacked"
      yAxisWidth={40}
      legendPosition="right"
      allowDecimals={false}
      valueFormatter={fmtNumber}
    />
  );
}
