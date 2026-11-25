"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export const SALES_HUB_TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/admin/sales" },
  { label: "Contacts", href: "/admin/sales/contacts" },
  { label: "Opportunities", href: "/admin/sales/opportunities" },
  { label: "Pipeline", href: "/admin/sales/pipeline" },
  { label: "AI queue", href: "/admin/sales/queue" },
  { label: "AI training", href: "/admin/sales/training" },
  { label: "Automation", href: "/admin/sales/automation" },
  { label: "Sequences", href: "/admin/sales/sequences" },
  { label: "Contracts", href: "/admin/sales/contracts" },
  { label: "Scheduled emails", href: "/admin/sales/scheduled-emails" },
  { label: "Forecast", href: "/admin/sales/forecast" },
  { label: "Analytics", href: "/admin/sales/analytics" },
  { label: "Task report", href: "/admin/sales/task-report" },
  { label: "Settings", href: "/admin/sales/settings" },
];

/** The tabs that stay in the Sales tab row; the rest live in the gear menu (SALES_GEAR_MENU). */
const MAIN_TAB_HREFS = new Set(["/admin/sales", "/admin/sales/contacts", "/admin/sales/opportunities", "/admin/sales/pipeline", "/admin/sales/contracts"]);
const TABS = SALES_HUB_TABS.filter((t) => MAIN_TAB_HREFS.has(t.href));

/** The Sales pages reached from the gear menu, in three groups (a separator before each `sep`). */
export const SALES_GEAR_MENU: { label: string; href: string; icon: string; sep?: boolean }[] = [
  { label: "AI queue", href: "/admin/sales/queue", icon: "ti-list-check" },
  { label: "AI training", href: "/admin/sales/training", icon: "ti-school" },
  { label: "Automation", href: "/admin/sales/automation", icon: "ti-bolt" },
  { label: "Sequences", href: "/admin/sales/sequences", icon: "ti-arrows-shuffle" },
  { label: "Scheduled", href: "/admin/sales/scheduled-emails", icon: "ti-clock" },
  { label: "Forecast", href: "/admin/sales/forecast", icon: "ti-chart-line", sep: true },
  { label: "Analytics", href: "/admin/sales/analytics", icon: "ti-chart-bar" },
  { label: "Task report", href: "/admin/sales/task-report", icon: "ti-report" },
  { label: "Settings", href: "/admin/sales/settings", icon: "ti-adjustments", sep: true },
];

/** The Sales tab row (classic chrome). The View Me / Team control lives in each page's gear (SalesViewGear). */
export function SalesHubTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs"); // null | "me" | userId

  // Preserve viewAs across tab navigation (Settings is never scoped).
  const tabSuffix = viewAs && viewAs !== "team" ? `?viewAs=${encodeURIComponent(viewAs)}` : "";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderBottom: "0.5px solid var(--border)", marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = t.href === "/admin/sales" ? pathname === t.href : pathname.startsWith(t.href);
          const href = t.href === "/admin/sales/settings" ? t.href : `${t.href}${tabSuffix}`;
          return (
            <Link key={t.href} href={href}
              style={{ paddingBottom: 8, fontSize: 12.5, textDecoration: "none",
                color: active ? "#185FA5" : "var(--muted-foreground)",
                fontWeight: active ? 600 : 400,
                borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent" }}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
