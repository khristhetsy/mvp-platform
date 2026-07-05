"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { RecordTasks } from "./RecordTasks";
import { OperationsAssistant } from "./OperationsAssistant";

export type OnboardRow = { id: string; founderName: string; founderEmail: string; company: string; percent: number; sla: { text: string; color: string; bg: string }; pastDue: boolean };

const GRID = "26px 1.5fr 1.1fr 1fr 100px 120px";

export function OnboardQueue({ rows }: { rows: OnboardRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Onboard · queue</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{rows.length} founders in progress</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>Expand a row to manage tasks</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <div></div><div>Founder</div><div>Company</div><div>Progress</div><div>SLA</div><div></div>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Every founder has completed onboarding. 🎉</p>
      ) : rows.map((r) => (
        <Fragment key={r.id}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: r.pastDue ? "#FEF6F6" : undefined }}>
            <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-label="Toggle tasks" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, transform: open === r.id ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▸</button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.founderName}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.founderEmail}</div>
            </div>
            <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.company}</div>
            <div>
              <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${r.percent}%`, background: r.percent >= 90 ? "#0F6E56" : "#2E78F5" }} /></div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3 }}>{r.percent}%</div>
            </div>
            <div><span style={{ fontSize: 10, fontWeight: 700, color: r.sla.color, background: r.sla.bg, borderRadius: 6, padding: "2px 7px" }}>{r.sla.text}</span></div>
            <div style={{ textAlign: "right" }}>
              <Link href={`/admin/companies/${r.id}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", borderRadius: 6, padding: "5px 12px", textDecoration: "none" }}>Continue →</Link>
            </div>
          </div>
          {open === r.id && (
            <div style={{ padding: "10px 14px 14px 40px", borderTop: "0.5px solid #eef1f5", background: "#FBFCFE", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
              <RecordTasks entityType="company" entityId={r.id} />
              <OperationsAssistant entityType="company" entityId={r.id} />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
