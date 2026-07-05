"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketingBell } from "@/components/marketing/notifications/MarketingBell";

type NavChild = { label: string; href: string };
type NavGroup = { label: string; href: string; routes: string[]; children?: NavChild[] };

// Grouped 2-tier nav: 6 top groups, each with an optional secondary sub-tab row.
const GROUPS: NavGroup[] = [
  { label: "Dashboard", href: "/admin/marketing", routes: ["/admin/marketing"] },
  { label: "Prospects", href: "/admin/marketing/prospects", routes: ["/admin/marketing/prospects"] },
  {
    label: "Contacts", href: "/admin/marketing/contacts",
    routes: ["/admin/marketing/contacts", "/admin/marketing/lists"],
    children: [
      { label: "Contacts", href: "/admin/marketing/contacts" },
      { label: "Lists", href: "/admin/marketing/lists" },
    ],
  },
  {
    label: "Campaigns", href: "/admin/marketing/campaigns",
    routes: ["/admin/marketing/campaigns", "/admin/marketing/sequences", "/admin/marketing/templates"],
    children: [
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
      { label: "Sequences", href: "/admin/marketing/sequences" },
      { label: "Templates", href: "/admin/marketing/templates" },
    ],
  },
  {
    label: "Analytics", href: "/admin/marketing/analytics",
    routes: ["/admin/marketing/analytics", "/admin/marketing/suppressions"],
    children: [
      { label: "Campaign results", href: "/admin/marketing/analytics" },
      { label: "Suppressions", href: "/admin/marketing/suppressions" },
    ],
  },
  {
    label: "Settings & Tools", href: "/admin/marketing/settings/notifications",
    routes: ["/admin/marketing/settings", "/admin/marketing/console", "/admin/marketing/plan", "/admin/marketing/aeo"],
    children: [
      { label: "Settings", href: "/admin/marketing/settings/notifications" },
      { label: "Console", href: "/admin/marketing/console" },
      { label: "Plan", href: "/admin/marketing/plan" },
      { label: "AEO", href: "/admin/marketing/aeo" },
    ],
  },
];

function groupActive(group: NavGroup, pathname: string): boolean {
  if (group.href === "/admin/marketing") return pathname === "/admin/marketing";
  return group.routes.some((r) => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r));
}

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
            width: 22, height: 22, borderRadius: 5, background: "#2E78F5",
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
              Sending via <span style={{ color: "#2E78F5", fontWeight: 500 }}>icfocap.com</span>
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
        {GROUPS.map((group) => {
          const active = groupActive(group, pathname);
          return (
            <Link
              key={group.href}
              href={group.href}
              style={{
                padding: "9px 12px",
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                color: active ? "#2E78F5" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {group.label}
            </Link>
          );
        })}
      </div>

      {/* Secondary sub-tab row for the active group */}
      {(() => {
        const group = GROUPS.find((g) => groupActive(g, pathname));
        if (!group?.children) return null;
        return (
          <div style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)", padding: "0 24px", display: "flex", gap: 4, flexShrink: 0 }}>
            {group.children.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
              return (
                <Link key={child.href} href={child.href} style={{
                  padding: "7px 10px", fontSize: 11.5, fontWeight: childActive ? 700 : 500,
                  color: childActive ? "#1A6CE4" : "var(--muted-foreground)",
                  borderBottom: childActive ? "2px solid #2E78F5" : "2px solid transparent",
                  textDecoration: "none", whiteSpace: "nowrap",
                }}>
                  {child.label}
                </Link>
              );
            })}
          </div>
        );
      })()}

      <div style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>{children}</div>
    </div>
  );
}
