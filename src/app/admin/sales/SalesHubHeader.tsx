"use client";

import { usePathname } from "next/navigation";
import { SalesHubTabs } from "./SalesHubTabs";
import { SalesViewGear } from "./SalesViewGear";
import { useAdminChrome } from "@/lib/ui/admin-chrome";

// Sales pages scoped by ?viewAs= that have no toolbar gear of their own; they get a
// gear holding only the View section. Other pages carry View in their own gear.
const VIEW_GEAR_ONLY = new Set(["/admin/sales", "/admin/sales/forecast"]);

export function SalesHubHeader() {
  const chrome = useAdminChrome();
  const pathname = usePathname();
  const viewGear = VIEW_GEAR_ONLY.has(pathname) ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <SalesViewGear />
    </div>
  ) : null;
  // Compact chrome: the top bar shows "Sales" and the hub tabs.
  if (chrome === "compact") return viewGear;
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Sales</h1>
      </div>
      <SalesHubTabs />
      {viewGear}
    </>
  );
}
