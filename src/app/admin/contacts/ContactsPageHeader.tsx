"use client";

import { SalesHubTabs } from "@/app/admin/sales/SalesHubTabs";
import { useAdminChrome } from "@/lib/ui/admin-chrome";

/** Standalone Contacts header: the page title and the View Me / Team control, no Sales hub tabs. */
export function ContactsPageHeader() {
  const chrome = useAdminChrome();
  // Compact chrome: the list's own toolbar carries the View control (SalesViewControl).
  if (chrome === "compact") return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Contacts</h1>
      </div>
      <SalesHubTabs viewOnly inline />
    </div>
  );
}
