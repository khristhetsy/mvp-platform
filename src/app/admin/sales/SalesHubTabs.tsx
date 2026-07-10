"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/admin/sales" },
  { label: "Contacts", href: "/admin/sales/contacts" },
  { label: "Opportunities", href: "/admin/sales/opportunities" },
  { label: "Pipeline", href: "/admin/sales/pipeline" },
  { label: "Forecast", href: "/admin/sales/forecast" },
  { label: "Tasks", href: "/admin/sales/tasks" },
  { label: "Settings", href: "/admin/sales/settings" },
];

export function SalesHubTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 18, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const active = t.href === "/admin/sales" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            style={{ paddingBottom: 8, fontSize: 12.5, textDecoration: "none",
              color: active ? "#185FA5" : "var(--muted-foreground)",
              fontWeight: active ? 600 : 400,
              borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent" }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
