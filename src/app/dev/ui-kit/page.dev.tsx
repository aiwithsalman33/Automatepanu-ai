import type { Metadata } from "next";

import { IntlProvider } from "@/components/intl-provider";
import { SurfaceSync } from "@/components/layout/surface-sync";
import { UiKitGallery } from "./ui-kit-gallery";

// Dev-only route (page.dev.tsx): registered by next.config.ts under
// `next dev` only, so it never ships in a production build.
export const metadata: Metadata = { title: "UI kit" };

export default function UiKitPage() {
  return (
    <IntlProvider>
      <SurfaceSync value="app" />
      <UiKitGallery />
    </IntlProvider>
  );
}
