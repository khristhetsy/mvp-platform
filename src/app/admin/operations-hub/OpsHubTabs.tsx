"use client";

// Operations Hub tab bar — shown across hub pages so the whole area feels like
// one workspace (mirrors the Marketing Hub tabs). Native tabs (Dashboard,
// Lifecycle) live under /admin/operations-hub; the rest link to existing screens.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/admin/operations-hub" },
  { label: "Lifecycle", href: "/admin/operations-hub/lifecycle" },
  { label: "Founder CRM", href: "/admin/crm/founders" },
  { label: "Investor CRM", href: "/admin/crm/investors" },
  { label: "Diligence", href: "/admin/diligence" },
  { label: "Deals", href: "/admin/matching" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Settings & Tools", href: "/admin/operations-hub/settings" },
];

export function OpsHubTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 18, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const active = t.href === "/admin/operations-hub" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            style={{
              paddingBottom: 8, fontSize: 12.5, textDecoration: "none",
              color: active ? "#185FA5" : "var(--muted-foreground)",
              fontWeight: active ? 600 : 400,
              borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent",
            }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
