"use client";

import { SalesHubTabs } from "./SalesHubTabs";

export function SalesHubHeader() {
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
