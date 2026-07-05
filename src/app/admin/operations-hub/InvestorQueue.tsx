"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { RecordTasks } from "./RecordTasks";

export type InvestorRow = { id: string; name: string; firm: string; email: string; approval: string; kyc: string; sla: { text: string; color: string; bg: string }; pastDue: boolean };

const GRID = "26px 1.5fr 1.2fr 1.1fr 1fr 110px";
const APPROVAL: Record<string, { text: string; color: string; bg: string }> = {
  draft: { text: "Draft", color: "#5F5E5A", bg: "#F1EFE8" },
  submitted: { text: "Submitted", color: "#185FA5", bg: "#E6F1FB" },
  changes_requested: { text: "Changes requested", color: "#854F0B", bg: "#FAEEDA" },
  rejected: { text: "Rejected", color: "#A32D2D", bg: "#FCEBEB" },
};
const KYC: Record<string, { text: string; color: string; bg: string }> = {
  not_started: { text: "KYC not started", color: "#5F5E5A", bg: "#F1EFE8" },
  pending: { text: "KYC pending", color: "#854F0B", bg: "#FAEEDA" },
  verified: { text: "KYC verified", color: "#0F6E56", bg: "#E1F5EE" },
  rejected: { text: "KYC rejected", color: "#A32D2D", bg: "#FCEBEB" },
};

export function InvestorQueue({ rows }: { rows: InvestorRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Onboard · queue</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{rows.length} investors in progress</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>Expand a row to manage tasks</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <div></div><div>Investor</div><div>Firm</div><div>Approval</div><div>KYC</div><div></div>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No investors in onboarding. 🎉</p>
      ) : rows.map((r) => {
        const ap = APPROVAL[r.approval] ?? APPROVAL.draft;
        const ky = KYC[r.kyc] ?? KYC.not_started;
        return (
          <Fragment key={r.id}>
            <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5, background: r.pastDue ? "#FEF6F6" : undefined }}>
              <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-label="Toggle tasks" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, transform: open === r.id ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▸</button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div>
              </div>
              <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.firm}</div>
              <div><span style={{ fontSize: 10, fontWeight: 600, color: ap.color, background: ap.bg, borderRadius: 10, padding: "2px 8px" }}>{ap.text}</span></div>
              <div><span style={{ fontSize: 10, fontWeight: 600, color: ky.color, background: ky.bg, borderRadius: 10, padding: "2px 8px" }}>{ky.text}</span></div>
              <div style={{ textAlign: "right" }}>
                <Link href="/admin/investors" style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", borderRadius: 6, padding: "5px 12px", textDecoration: "none" }}>Open →</Link>
              </div>
            </div>
            {open === r.id && (
              <div style={{ padding: "10px 14px 14px 40px", borderTop: "0.5px solid #eef1f5", background: "#FBFCFE" }}>
                <RecordTasks entityType="investor" entityId={r.id} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
