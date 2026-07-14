"use client";

// IR Hub lifecycle card with an Investor / Founder toggle. Reuses LifecycleStepper
// for the numbered-steps + drop-off + AI layout; the toggle swaps which pipeline
// it renders (investor pipeline vs founder journey).
import { useState } from "react";
import { LifecycleStepper, type LifecycleStage } from "@/components/admin/LifecycleStepper";

const ACCENT = "#4338CA";

export function IrLifecycleCard({
  investorStages, founderStages,
}: {
  investorStages: LifecycleStage[];
  founderStages: LifecycleStage[];
}) {
  const [mode, setMode] = useState<"investor" | "founder">("investor");
  const stages = mode === "investor" ? investorStages : founderStages;
  if ((investorStages?.length ?? 0) === 0 && (founderStages?.length ?? 0) === 0) return null;

  const seg = (m: "investor" | "founder", label: string) => (
    <button onClick={() => setMode(m)} style={{ fontSize: 12, padding: "4px 11px", background: mode === m ? ACCENT : "transparent", color: mode === m ? "#fff" : "var(--muted-foreground)", border: "none", cursor: "pointer" }}>{label}</button>
  );

  const toggle = (
    <span style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      {seg("investor", "Investor")}{seg("founder", "Founder")}
    </span>
  );

  return (
    <LifecycleStepper
      key={mode}
      title={mode === "investor" ? "Investor journey" : "Founder journey"}
      stages={stages}
      accent={ACCENT}
      askLabel="IR AI"
      headerRight={toggle}
    />
  );
}
