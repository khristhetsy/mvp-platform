"use client";

import Link from "next/link";
import "./marketing-mobile.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MarketingBell } from "@/components/marketing/notifications/MarketingBell";

type NavChild = { label: string; href: string };
type NavGroup = { label: string; href: string; routes: string[]; children?: NavChild[] };

// Grouped nav: 6 top tabs. Groups with children open a dropdown (no second sub-tab row).
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
    routes: ["/admin/marketing/campaigns", "/admin/marketing/deal-notices", "/admin/marketing/partner-codes", "/admin/marketing/sequences", "/admin/marketing/templates", "/admin/marketing/testimonials"],
    children: [
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
      { label: "Deal notices", href: "/admin/marketing/deal-notices" },
      { label: "Partner codes", href: "/admin/marketing/partner-codes" },
      { label: "Sequences", href: "/admin/marketing/sequences" },
      { label: "Templates", href: "/admin/marketing/templates" },
      { label: "Testimonials", href: "/admin/marketing/testimonials" },
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
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close the open dropdown on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Flat header (pinned) — dark title + underlined tab row, no gradient banner. */}
      <div style={{
        background: "var(--background)",
        padding: "14px 24px 0",
        flexShrink: 0,
        position: "relative",
        zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--muted-foreground)" }}>Admin workspace</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: "3px 0 0", letterSpacing: "-0.01em", color: "var(--foreground)" }}>Marketing</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--muted)", borderRadius: 999, padding: "4px 11px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75" }} />
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Sending via <span style={{ color: "#2E78F5", fontWeight: 500 }}>icapos.com</span>
              </span>
            </div>
            <MarketingBell />
          </div>
        </div>

        <div ref={barRef} style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap", borderBottom: "0.5px solid var(--border)" }}>
          {GROUPS.map((group) => {
            const active = groupActive(group, pathname);
            const tabStyle: React.CSSProperties = {
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? "#1A6CE4" : "var(--muted-foreground)",
              borderBottom: active ? "2px solid #1A6CE4" : "2px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            };
            if (!group.children) {
              return (
                <Link key={group.href} href={group.href} style={tabStyle}>
                  {group.label}
                </Link>
              );
            }
            const isOpen = open === group.label;
            return (
              <div key={group.href} style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : group.label)}
                  style={{ ...tabStyle, background: "none", borderTop: 0, borderLeft: 0, borderRight: 0, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {group.label}
                  <span aria-hidden style={{ fontSize: 9, opacity: 0.7 }}>{isOpen ? "\u25B4" : "\u25BE"}</span>
                </button>
                {isOpen && (
                  <div
                    role="menu"
                    style={{
                      position: "absolute", top: "100%", left: 0, minWidth: 210, padding: 6, zIndex: 40,
                      background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12,
                      boxShadow: "0 12px 30px rgba(11,19,48,.18)",
                    }}
                  >
                    {group.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          role="menuitem"
                          onClick={() => setOpen(null)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            minHeight: 44, padding: "0 12px", borderRadius: 8, fontSize: 13,
                            fontWeight: childActive ? 600 : 500,
                            color: childActive ? "#1A6CE4" : "var(--foreground)",
                            background: childActive ? "rgba(26,108,228,.08)" : "transparent",
                            textDecoration: "none", whiteSpace: "nowrap",
                          }}
                        >
                          {child.label}
                          {childActive && <span aria-hidden>{"\u2713"}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mk-m-body" style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>{children}</div>
    </div>
  );
}
