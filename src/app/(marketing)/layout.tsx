import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing-site/SiteNav";
import { SiteFooter } from "@/components/marketing-site/SiteFooter";
import { DemoDialog } from "@/components/marketing-site/DemoDialog";
import { AiFirstMode } from "@/components/marketing-site/AiFirstMode";
import { siteFontVariables } from "@/lib/marketing-site/fonts";

/**
 * Public marketing-site layout (spec §3, §5). Nested under the root layout
 * (which owns <html>/<body>), so this only provides the site chrome: font
 * variables, skip-to-content link (§11), the top Nav, <main>, the Footer, the
 * demo dialog, and the full-screen AI-first mode — the single AI surface, opened
 * by the nav "AI Mode" button, its bottom-right launcher, or by default on "/".
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${siteFontVariables} min-h-screen bg-white font-site-body text-site-ink antialiased`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-site-navy focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
      <DemoDialog />
      <AiFirstMode />
    </div>
  );
}
