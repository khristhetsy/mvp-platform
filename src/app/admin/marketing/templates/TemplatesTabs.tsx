"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Templates", href: "/admin/marketing/templates" },
  { label: "Images", href: "/admin/marketing/templates/images" },
];

/** Templates | Images tab pair shown at the top of both pages. */
export function TemplatesTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 18 }}>
      {TABS.map((t) => {
        const active = t.href === "/admin/marketing/templates" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            style={{ paddingBottom: 8, fontSize: 12.5, textDecoration: "none", color: active ? "#185FA5" : "var(--muted-foreground)", fontWeight: active ? 600 : 400, borderBottom: active ? "2px solid #2E78F5" : "2px solid transparent" }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
