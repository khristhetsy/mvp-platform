"use client";

/** IR Hub tab strip — rendered in the compact top bar (AdminHubTabsInline) and, on the
 *  classic chrome, at the top of each IR page (IrHubHeader). */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminChrome } from "@/lib/ui/admin-chrome";

/** Hub tabs in the mockup's order. Dashboard / Projects / Tasks / Share Project / Founder report / Odoo import. */
export const IR_HUB_TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/admin/ir" },
  { label: "Projects", href: "/admin/ir/projects" },
  { label: "Tasks", href: "/admin/ir/tasks" },
  { label: "Share Project", href: "/admin/ir/matches" },
  { label: "Founder report", href: "/admin/ir/report" },
  { label: "Odoo import", href: "/admin/ir/import" },
];

/** The active tab is the longest href the path sits under (so /projects/new lights Projects); the hub root only when exact. */
export function activeHubTab(tabs: { href: string }[], pathname: string, root: string): string | null {
  let best: string | null = null;
  for (const t of tabs) {
    const hit = t.href === root ? pathname === root : pathname === t.href || pathname.startsWith(`${t.href}/`);
    if (hit && (!best || t.href.length > best.length)) best = t.href;
  }
  return best;
}

export function IrHubHeader({ title = "Investor Relations Hub" }: { title?: string }) {
  const chrome = useAdminChrome();
  const pathname = usePathname() ?? "";
  if (chrome === "compact") return null;
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>{title}</h1>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-100">
        {IR_HUB_TABS.map((t) => {
          const active = activeHubTab(IR_HUB_TABS, pathname, "/admin/ir") === t.href;
          return <Link key={t.href} href={t.href} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t.label}</Link>;
        })}
      </div>
    </>
  );
}
