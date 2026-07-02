"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketingBell } from "@/components/marketing/notifications/MarketingBell";

const NAV = [
  { label: "Dashboard",    href: "/admin/marketing" },
  { label: "Plan",         href: "/admin/marketing/plan" },
  { label: "Contacts",     href: "/admin/marketing/contacts" },
  { label: "Lists",        href: "/admin/marketing/lists" },
  { label: "Campaigns",    href: "/admin/marketing/campaigns" },
  { label: "Sequences",    href: "/admin/marketing/sequences" },
  { label: "Templates",    href: "/admin/marketing/templates" },
  { label: "Analytics",    href: "/admin/marketing/analytics" },
  { label: "AEO",          href: "/admin/marketing/aeo" },
  { label: "Suppressions", href: "/admin/marketing/suppressions" },
  { label: "Settings",     href: "/admin/marketing/settings/notifications" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar */}
      <div style={{
        background: "var(--background)",
        borderBottom: "0.5px solid var(--border)",
        padding: "0 24px",
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5, background: "#534AB7",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EEEDFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Marketing hub</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75" }} />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Sending via <span style={{ color: "#534AB7", fontWeight: 500 }}>mail.myicfos.com</span>
            </span>
          </div>
          <MarketingBell />
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{
        background: "var(--background)",
        borderBottom: "0.5px solid var(--border)",
        padding: "0 24px",
        display: "flex",
        gap: 2,
        flexShrink: 0,
      }}>
        {NAV.map((item) => {
          const active =
            item.href === "/admin/marketing"
              ? pathname === "/admin/marketing"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "9px 12px",
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                color: active ? "#534AB7" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid #534AB7" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>{children}</div>
    </div>
  );
}
