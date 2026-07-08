"use client";

// Shows a "← Back to Investor Relations Hub" link at the top of admin surface pages that
// are reachable from the hub, so an admin can return after opening a surface.
// Self-hides on non-surface pages (including the hub itself and the dashboard).

import Link from "next/link";
import { usePathname } from "next/navigation";

const SURFACE_PREFIXES = [
  "/admin/actions",
  "/admin/investors",
  "/admin/companies",
  "/admin/crm",
  "/admin/intro-requests",
  "/admin/deal-rooms",
  "/admin/matching",
  "/admin/events",
  "/admin/compliance",
  "/admin/readiness",
];

export function OpsHubBackBar() {
  const pathname = usePathname() ?? "";
  const onSurface = SURFACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!onSurface) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <Link
        href="/admin/playbook"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}
      >
        ← Back to Investor Relations Hub
      </Link>
    </div>
  );
}
