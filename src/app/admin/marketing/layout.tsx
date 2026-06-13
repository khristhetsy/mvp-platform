"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/admin/marketing" },
  { label: "Contacts", href: "/admin/marketing/contacts" },
  { label: "Campaigns", href: "/admin/marketing/campaigns" },
  { label: "Sequences", href: "/admin/marketing/sequences" },
  { label: "Templates", href: "/admin/marketing/templates" },
  { label: "Analytics", href: "/admin/marketing/analytics" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Sub-nav */}
      <div
        style={{
          borderBottom: "0.5px solid var(--border)",
          background: "var(--background)",
          padding: "0 24px",
          display: "flex",
          gap: 4,
          flexShrink: 0,
        }}
      >
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
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid #534AB7" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </Link>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 4 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Sending via{" "}
            <span style={{ color: "#534AB7", fontWeight: 500 }}>mail.myicfos.com</span>
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}
