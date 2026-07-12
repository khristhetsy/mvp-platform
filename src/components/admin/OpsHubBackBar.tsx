"use client";

// Shows a "← Back to Investor Relations Hub" link at the top of admin surface pages that
// are reachable from the hub, so an admin can return after opening a surface.
// Self-hides on non-surface pages (including the hub itself and the dashboard).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  // Only show to users who can actually use the IR hub (unrestricted admins, or
  // members with the Investor Relations Hub in their granted paths).
  const [irAccess, setIrAccess] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/departments/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) { setIrAccess(true); return; } // fail-open for unconfigured departments
        const unrestricted = Boolean(d.unrestricted ?? d.isAdmin);
        const paths: string[] = d.paths ?? [];
        setIrAccess(unrestricted || paths.some((p) => p.startsWith("/admin/playbook")));
      })
      .catch(() => { if (!cancelled) setIrAccess(true); });
    return () => { cancelled = true; };
  }, []);

  const onSurface = SURFACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!onSurface || irAccess === false || irAccess === null) return null;
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
