"use client";

import Link from "next/link";
import type { PlaybookCard } from "@/lib/playbook/types";
import { CADENCE_LABEL } from "@/lib/playbook/types";
import { renderInline } from "./format";

const NAVY = "#0f2147";

export function ModuleCard({
  card,
  count,
  isAdmin,
  onEdit,
}: {
  card: PlaybookCard;
  count?: number;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const c = card.content;
  const undocumented = card.state === "undocumented";
  const noSteps = card.state === "no_steps";

  return (
    <div id={`pb-${card.navId}`} style={{ scrollMarginTop: 16, background: "#fff", border: "0.5px solid #e2e6ed", borderLeft: `3px solid ${undocumented ? "#EF9F27" : "#2E78F5"}`, borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link href={card.href} style={{ fontSize: 15, fontWeight: 600, color: NAVY, textDecoration: "none" }}>{card.label}</Link>
            <span style={{ fontSize: 11, color: "#9aa3b0" }}>{card.href}</span>
            {typeof count === "number" ? (
              <span style={{ fontSize: 11, fontWeight: 600, background: count > 0 ? "#FDECEC" : "#EAF3E9", color: count > 0 ? "#A32D2D" : "#0F6E56", padding: "1px 8px", borderRadius: 999 }}>
                {count} pending
              </span>
            ) : null}
          </div>
          {c?.roleNote ? <p style={{ fontSize: 12.5, color: "#5f5e5a", margin: "4px 0 0" }}>{c.roleNote}</p> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {c ? <span style={{ fontSize: 11, fontWeight: 500, color: "#1A6CE4", background: "#EEEDFE", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{CADENCE_LABEL[c.cadence]}</span> : null}
          {isAdmin ? (
            <button type="button" onClick={onEdit} style={{ fontSize: 12, color: "#2E78F5", background: "none", border: "0.5px solid #CECBF6", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 500 }}>
              {undocumented ? "Add steps" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {c && c.flags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {c.flags.map((f, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: f.kind === "hard_gate" ? "#FAEEDA" : "#E6F1FB", color: f.kind === "hard_gate" ? "#854F0B" : "#185FA5", border: `1px solid ${f.kind === "hard_gate" ? "#EDD8AE" : "#B5D4F4"}` }}>
              {f.kind === "hard_gate" ? "⛔ Gate" : "Guardrail"} · {f.label}
            </span>
          ))}
        </div>
      ) : null}

      {undocumented ? (
        <p style={{ fontSize: 12.5, color: "#854F0B", background: "#FBF4E6", border: "0.5px solid #EDD8AE", borderRadius: 8, padding: "8px 10px", margin: "12px 0 0" }}>
          New surface — no steps yet. {isAdmin ? "Add them." : "An admin can add them."}
        </p>
      ) : noSteps ? (
        <p style={{ fontSize: 12.5, color: "#854F0B", background: "#FBF4E6", border: "0.5px solid #EDD8AE", borderRadius: 8, padding: "8px 10px", margin: "12px 0 0" }}>
          Documented, but no steps recorded yet.
        </p>
      ) : (
        <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          {c!.steps.map((s) => (
            <li key={s.step_no} style={{ fontSize: 13, lineHeight: 1.55, color: "#3d3d3a" }}>{renderInline(s.body)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
