import type { ReactNode } from "react";
import { MarketingNav } from "@/components/MarketingNav";

/** Public marketing layout — top navigation only, no workspace sidebar. */
export function MarketingShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="cap-marketing-surface flex min-h-screen flex-col text-[var(--navy)]">
      <MarketingNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
