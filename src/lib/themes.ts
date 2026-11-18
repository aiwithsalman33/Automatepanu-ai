/**
 * Single source of truth for the color-theme catalog.
 *
 * The user panel no longer offers a theme or mode choice: it renders
 * the one purple light palette of the APP SURFACE (see SURFACE below
 * and globals.css). The accent/mode machinery stays for the admin
 * panel (its dark/light toggle) and so a dark app theme can return.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `html[data-theme="..."]` blocks — that file is the one we paste
 * theme tokens into. This module only carries the metadata the UI
 * (settings picker, no-flash boot script) needs.
 *
 * Adding a new theme is a two-step change:
 *   1. Append the new `html[data-theme="<id>"]` block in globals.css
 *      with every token from an existing theme (use violet as the
 *      shape reference).
 *   2. Add an entry below. The order here drives the picker grid.
 */

export const THEME_IDS = ["violet"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "violet";

export const STORAGE_KEY = "wacrm.theme";

/**
 * MODE — the light/dark dimension, orthogonal to the accent theme.
 *
 * The CSS variables live in `src/app/globals.css` under
 * `html[data-mode="..."]` blocks (neutral surfaces only). Applied
 * at runtime via `document.documentElement.dataset.mode`. Dark is
 * the historical default and stays the app's identity; light is the
 * opt-in eye-strain-friendly alternative.
 *
 * Persisted under its own localStorage key so it composes freely
 * with the accent choice (you can run Violet-light or Violet-dark).
 */
export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const DEFAULT_MODE: Mode = "dark";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static swatch color for the picker chip. Hard-coded so the boot
   * script / picker cards don't need a getComputedStyle round trip
   * before the page settles. Must mirror `--primary` of the same
   * theme in globals.css.
   */
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "violet",
    name: "Violet",
    tagline: "The default — confident, slightly playful.",
    swatch: "oklch(0.526 0.247 293)",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * SURFACE — which token set a route renders with.
 *
 * "app" (the signed-in user panel) gets the purple light palette in
 * globals.css (:root[data-surface="app"]). Everything else (admin,
 * marketing) keeps the MODE/ACCENT tokens.
 * The boot script applies it from the path before first paint; the
 * <SurfaceSync> component keeps it right across client navigation.
 */
export const APP_SURFACE_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/contacts",
  "/pipelines",
  "/broadcasts",
  "/automations",
  "/flows",
  "/agents",
  "/notifications",
  "/settings",
  "/dev",
  // Auth and invite pages (redesign phase G).
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/join",
] as const;

export function isAppSurfacePath(pathname: string): boolean {
  return APP_SURFACE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
