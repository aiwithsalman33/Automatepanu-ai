'use client';

import { useLayoutEffect } from 'react';

/**
 * Puts data-surface on <html> while this route group is mounted.
 *
 * The boot script in src/app/layout.tsx already sets it from the URL
 * on a full page load. This keeps it right on client-side navigation
 * between surfaces (admin ↔ user panel, marketing → app), where the
 * boot script doesn't run again. Layout effect, so the tokens switch
 * before the browser paints the new route.
 */
export function SurfaceSync({ value }: { value: 'app' }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset.surface = value;
    return () => {
      if (html.dataset.surface === value) delete html.dataset.surface;
    };
  }, [value]);
  return null;
}
