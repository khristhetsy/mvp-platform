import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing-site/SiteNav";
import { siteFontVariables } from "@/lib/marketing-site/fonts";

/**
 * Public layout for pages outside the (marketing) group (events, deals, sign in,
 * credits). Uses the same SiteNav as the main site so the header, links and
 * mobile menu match everywhere.
 */
export function MarketingShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`${siteFontVariables} cap-marketing-surface flex min-h-screen flex-col text-[var(--navy)]`}>
      <SiteNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
