"use client";

/**
 * Hub tabs rendered inside the compact top bar. Only the Sales hub has a page-level tab
 * strip today (SalesHubHeader); Marketing / Operations keep their own rows, so here
 * they just get their hub name. Preserves ?viewAs= across Sales tabs like SalesHubTabs.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SALES_HUB_TABS } from "@/app/admin/sales/SalesHubTabs";
import { IR_HUB_TABS, activeHubTab } from "@/app/admin/ir/IrHubTabs";

const HUBS: { prefix: string; label: string }[] = [
  { prefix: "/admin/sales", label: "Sales" },
  { prefix: "/admin/marketing", label: "Marketing" },
  { prefix: "/admin/operations-hub", label: "Operations" },
  { prefix: "/admin/investors", label: "Investors" },
  { prefix: "/admin/ir", label: "Investor relations" },
  { prefix: "/admin/playbook", label: "Investor relations" },
  { prefix: "/admin/ceo", label: "CEO" },
];

export function AdminHubTabsInline() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const hub = HUBS.find((h) => pathname === h.prefix || pathname.startsWith(`${h.prefix}/`));
  if (!hub) return <span className="truncate text-[13px] font-semibold text-slate-800">Admin</span>;

  const viewAs = searchParams.get("viewAs");
  const suffix = viewAs && viewAs !== "team" ? `?viewAs=${encodeURIComponent(viewAs)}` : "";
  const tabs = hub.prefix === "/admin/sales" ? SALES_HUB_TABS : hub.label === "Investor relations" ? IR_HUB_TABS : [];

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <span className="mr-2 shrink-0 text-[13px] font-semibold text-slate-800">{hub.label}</span>
      {tabs.map((t) => {
        const active = activeHubTab(tabs, pathname, hub.prefix) === t.href;
        const href = t.href.endsWith("/settings") ? t.href : `${t.href}${suffix}`;
        return (
          <Link key={t.href} href={href} aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${active ? "bg-[var(--blue-muted)] font-semibold text-[var(--blue-hover)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
