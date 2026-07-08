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
      {/* Gradient banner (pinned) — mirrors the CEO Hub / HubShell header, with the
          top-level marketing tabs living inside the gradient. */}
      <div style={{
        background: "linear-gradient(120deg, #0A1A40 0%, #12275C 55%, #1A6CE4 140%)",
        color: "#fff",
        padding: "16px 24px 0",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", color: "#9DBBF0" }}>Admin workspace</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: "4px 0 0", letterSpacing: "-0.01em" }}>Marketing Hub</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "4px 11px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6EE7B7" }} />
              <span style={{ fontSize: 11, color: "#DCE6F8" }}>
                Sending via <span style={{ color: "#fff", fontWeight: 500 }}>icapos.com</span>
              </span>
            </div>
            <MarketingBell />
          </div>
        </div>

        <div style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap" }}>
          {GROUPS.map((group) => {
            const active = groupActive(group, pathname);
            return (
              <Link
                key={group.href}
                href={group.href}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "#B7CBEF",
                  borderBottom: active ? "2px solid #fff" : "2px solid transparent",
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
