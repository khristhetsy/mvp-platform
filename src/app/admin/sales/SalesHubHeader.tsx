"use client";

import { usePathname } from "next/navigation";
import { SalesHubTabs } from "./SalesHubTabs";
import { SalesViewGear } from "./SalesViewGear";
import { useAdminChrome } from "@/lib/ui/admin-chrome";
import { AutomationToast } from "@/components/sales/AutomationToast";

// Sales pages whose own toolbar carries the gear (View section, hub menu and page items).
// Every other Sales page gets the gear here, so the hub menu is always one click away.
const OWN_GEAR = new Set(["/admin/sales/contacts", "/admin/sales/opportunities", "/admin/sales/pipeline", "/admin/sales/tasks", "/admin/sales/bookings"]);

export function SalesHubHeader() {
  const chrome = useAdminChrome();
  const pathname = usePathname();
  const viewGear = !OWN_GEAR.has(pathname) ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <SalesViewGear />
    </div>
  ) : null;
  // Compact chrome: the top bar shows "Sales" and the hub tabs.
  if (chrome === "compact") return <><AutomationToast />{viewGear}</>;
  return (
    <>
      <AutomationToast />
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Sales</h1>
      </div>
      <SalesHubTabs />
      {viewGear}
    </>
  );
}
