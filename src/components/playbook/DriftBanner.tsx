"use client";

import type { OrphanEntry } from "@/lib/playbook/types";

export function DriftBanner({ undocumented, noSteps, orphaned }: { undocumented: number; noSteps: number; orphaned: OrphanEntry[] }) {
  const inSync = undocumented === 0 && noSteps === 0 && orphaned.length === 0;

  if (inSync) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EAF3E9", border: "0.5px solid #C7E4C2", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, color: "#0F6E56" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} /> In sync with the menu — every surface is documented.
      </div>
    );
  }

  const parts: string[] = [];
  if (undocumented) parts.push(`${undocumented} undocumented`);
  if (noSteps) parts.push(`${noSteps} documented but empty`);
  if (orphaned.length) parts.push(`${orphaned.length} orphaned`);

  return (
    <div style={{ background: "#FBF4E6", border: "0.5px solid #EDD8AE", borderRadius: 10, padding: "10px 14px" }}>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#854F0B", margin: 0 }}>Drift detected — {parts.join(" · ")}</p>
      <p style={{ fontSize: 11.5, color: "#7a5b12", margin: "3px 0 0" }}>
        The menu is the source of truth. New surfaces show as cards to fill in; renamed surfaces update automatically; removed surfaces leave orphaned entries below to clean up.
      </p>
    </div>
  );
}
