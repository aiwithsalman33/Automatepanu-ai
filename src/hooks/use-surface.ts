'use client';

import { useSyncExternalStore } from 'react';

/**
 * The token surface of the current page: "app" for the signed-in user
 * panel (globals.css :root[data-surface="app"]), null elsewhere. Read
 * from <html data-surface>, which the boot script and <SurfaceSync> own.
 * Null during SSR and the first hydration render.
 */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-surface'],
  });
  return () => obs.disconnect();
}

export function useSurface(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.surface ?? null,
    () => null,
  );
}
