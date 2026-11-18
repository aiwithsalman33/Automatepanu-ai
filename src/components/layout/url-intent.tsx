"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Runs a page action once when the URL asks for it, then removes the
 * parameter(s) so a refresh or Back doesn't run it again. Used by the
 * "+ New" menu (`?new=1` opens the create dialog) and the command
 * palette (`?open=<contact>`, `?deal=<id>`).
 *
 * `ready` delays the action until the page has what it needs (e.g. the
 * Deals board waits for its pipeline). Render it inside <Suspense>:
 * it reads useSearchParams.
 */
export function UrlIntent({
  param,
  ready = true,
  clear,
  onIntent,
}: {
  param: string;
  ready?: boolean;
  /** Other params to drop along with `param`. */
  clear?: string[];
  onIntent: (value: string, params: URLSearchParams) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(param);
  const handled = useRef<string | null>(null);
  const run = useRef(onIntent);
  useEffect(() => {
    run.current = onIntent;
  });

  useEffect(() => {
    if (!value || !ready) return;
    const key = `${pathname}?${params.toString()}`;
    if (handled.current === key) return;
    handled.current = key;
    run.current(value, new URLSearchParams(params.toString()));
    const next = new URLSearchParams(params.toString());
    for (const p of [param, ...(clear ?? [])]) next.delete(p);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // clear is read at fire time; it never changes for a given call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready, param, params, pathname, router]);

  return null;
}
