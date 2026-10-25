"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const PAGES = [
  { label: "Tasks", href: "/admin/sales/settings", icon: "ti-checklist" },
  { label: "Notifications", href: "/admin/sales/settings/notifications", icon: "ti-bell" },
];

export function SettingsSubNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="ma-rail" style={{ width: 160, flexShrink: 0, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 8, alignSelf: "flex-start" }}>
      <select className="ma-rail-select" aria-label="Settings sections" value={pathname} onChange={(e) => router.push(e.target.value)}>
        {PAGES.map((p) => <option key={p.href} value={p.href}>Settings: {p.label}</option>)}
      </select>
      <div className="ma-rail-full" style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px" }}>Settings</div>
      {PAGES.map((p) => {
        const active = pathname === p.href;
        return (
          <Link key={p.href} href={p.href} className="ma-rail-full" style={{ display: "block", fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#185FA5" : "var(--muted-foreground)", background: active ? "#E6F1FB" : "transparent", borderRadius: 7, padding: "8px 10px", marginBottom: 3, textDecoration: "none" }}>
            <i className={`ti ${p.icon}`} aria-hidden="true" /> {p.label}
          </Link>
        );
      })}
    </div>
  );
}
