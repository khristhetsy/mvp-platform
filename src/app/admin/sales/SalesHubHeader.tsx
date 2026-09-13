"use client";

import { SalesHubTabs } from "./SalesHubTabs";
import { useAdminChrome } from "@/lib/ui/admin-chrome";

export function SalesHubHeader() {
  const chrome = useAdminChrome();
  // Compact chrome: the top bar already shows "Sales" and the hub tabs, so the page
  // only keeps the View Me / Team control (right-aligned, one slim row).
  if (chrome === "compact") return <SalesHubTabs viewOnly />;
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Sales hub</h1>
      </div>
      <SalesHubTabs />
    </>
  );
}
