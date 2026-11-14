"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUTOMATION_TRIGGERS, reasonText, triggerLabel, type TriggerKey } from "@/lib/sales/automation-core";
import type { AutomationApproval, AutomationRule } from "@/lib/sales/automation";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };

const card: React.CSSProperties = { border: "0.5px solid var(--border)", borderRadius: 10, background: "var(--background)", padding: 14, marginBottom: 12 };
const inp: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted-foreground)", display: "block", margin: "10px 0 4px" };
const btn = (primary: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: primary ? 600 : 400, color: primary ? "#fff" : "var(--muted-foreground)", background: primary ? "#2E78F5" : "transparent", border: primary ? "none" : "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 14px", cursor: "pointer" });
const chip = (on: boolean): React.CSSProperties => ({ fontSize: 12, padding: "5px 11px", borderRadius: 999, cursor: "pointer", border: on ? "0.5px solid #B5D4F4" : "0.5px solid #d7dbe3", background: on ? "#E6F1FB" : "transparent", color: on ? "#185FA5" : "var(--muted-foreground)", fontWeight: on ? 600 : 400 });

type Draft = { id: string | null; stageId: string; name: string; action: "create" | "move"; triggers: string[]; matchMode: "any" | "all"; mode: "ask" | "auto"; waitDays: number; fromStageIds: string[]; enabled: boolean };

function blank(stageId: string): Draft {
  return { id: null, stageId, name: "", action: "move", triggers: [], matchMode: "any", mode: "ask", waitDays: 0, fromStageIds: [], enabled: true };
}
function fromRule(r: AutomationRule): Draft {
  return { id: r.id, stageId: r.stage_id, name: r.name, action: r.action, triggers: r.triggers, matchMode: r.match_mode, mode: r.mode, waitDays: r.wait_days, fromStageIds: r.from_stage_ids, enabled: r.enabled };
}

export function AutomationClient({ stages, initialRules, initialApprovals }: { stages: Stage[]; initialRules: AutomationRule[]; initialApprovals: AutomationApproval[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "Unknown stage";

  async function reload() {
    const [r, a] = await Promise.all([
      fetch("/api/sales/automation/rules").then((x) => x.json()),
      fetch("/api/sales/automation/approvals").then((x) => x.json()),
    ]);
    setRules(r.rules ?? []);
    setApprovals(a.approvals ?? []);
    router.refresh();
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setError("Give the rule a name."); return; }
    if (draft.triggers.length === 0) { setError("Pick at least one trigger."); return; }
    setBusy(true); setError(null);
    try {
      const { id, ...body } = draft;
      const res = await fetch(id ? `/api/sales/automation/rules/${id}` : "/api/sales/automation/rules", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(d.error ?? "Could not save the rule."); return; }
      setDraft(null);
      await reload();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!draft?.id || !confirm("Delete this rule?")) return;
    setBusy(true);
    try {
      await fetch(`/api/sales/automation/rules/${draft.id}`, { method: "DELETE" });
      setDraft(null);
      await reload();
    } finally { setBusy(false); }
  }

  async function toggle(r: AutomationRule) {
    await fetch(`/api/sales/automation/rules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fromRule(r), enabled: !r.enabled, id: undefined }) });
    await reload();
  }

  async function decide(id: string, decision: "approve" | "keep") {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/sales/automation/approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(d.error ?? "Could not save your answer.");
      await reload();
    } finally { setBusy(false); }
  }

  const summary = (d: Draft) => {
    if (d.triggers.length === 0) return "Pick at least one trigger.";
    const when = reasonText({ triggers: d.triggers, match_mode: d.matchMode }, d.triggers[0] as TriggerKey);
    const wait = d.triggers.includes("signed_up_unpaid") && d.waitDays > 0 ? ` (after ${d.waitDays} days)` : "";
    const from = d.fromStageIds.length ? `, only if it is in ${d.fromStageIds.map(stageName).join(" or ")}` : "";
    const how = d.mode === "ask" ? "ask you first" : "do it automatically";
    return d.action === "create"
      ? `When ${d.matchMode === "all" ? when : d.triggers.map((t) => triggerLabel(t).toLowerCase()).join(" or ")}${wait}, create an opportunity in ${stageName(d.stageId)} and ${how === "ask you first" ? "tell you" : "log it"}.`
      : `When ${d.matchMode === "all" ? when : d.triggers.map((t) => triggerLabel(t).toLowerCase()).join(" or ")}${wait}${from}, ${how} to move it to ${stageName(d.stageId)}.`;
  };

  return (
    <div>
      {error && <div role="alert" style={{ fontSize: 12, color: "#A32D2D", marginBottom: 10 }}>{error}</div>}

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Waiting for your answer · {approvals.length}</div>
        {approvals.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No suggestions waiting. When a rule asks first, it shows here and on the opportunity page.</div>}
        {approvals.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: "0.5px solid #eef1f5" }}>
            <div style={{ flex: "1 1 260px", fontSize: 12.5 }}>
              <Link href={`/admin/sales/opportunities/${a.opportunity_id}`} style={{ color: "#185FA5", fontWeight: 600 }}>Open opportunity</Link>
              {" "}move {a.from_stage_name ?? "current stage"} to {a.to_stage_name ?? "the next stage"}
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Because {a.reason}</div>
            </div>
            <button type="button" disabled={busy} onClick={() => decide(a.id, "approve")} style={btn(true)}>Approve move</button>
            <button type="button" disabled={busy} onClick={() => decide(a.id, "keep")} style={btn(false)}>Keep here</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Automation rules</div>
        <button type="button" style={btn(true)} onClick={() => { setError(null); setDraft(blank(stages[0]?.id ?? "")); }}>Add rule</button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "0 0 10px" }}>Moving a card by hand always works. A manual move cancels any suggestion waiting on that opportunity.</p>

      {stages.map((s) => {
        const rs = rules.filter((r) => r.stage_id === s.id);
        if (rs.length === 0) return null;
        return (
          <div key={s.id} style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{s.name}</div>
            {rs.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "7px 0", borderTop: "0.5px solid #eef1f5", opacity: r.enabled ? 1 : 0.55 }}>
                <div style={{ flex: "1 1 260px", fontSize: 12.5 }}>
                  {r.name}
                  <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{summary(fromRule(r))}</div>
                </div>
                <button type="button" style={chip(r.enabled)} onClick={() => void toggle(r)}>{r.enabled ? "On" : "Off"}</button>
                <button type="button" style={btn(false)} onClick={() => { setError(null); setDraft(fromRule(r)); }}>Edit</button>
              </div>
            ))}
          </div>
        );
      })}

      {draft && (
        <div role="dialog" aria-label="Edit rule" style={{ ...card, borderColor: "#B5D4F4" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{draft.id ? "Edit rule" : "New rule"}</div>
          <label style={lbl}>Name</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...inp, width: "100%" }} />
          <label style={lbl}>Target stage</label>
          <select value={draft.stageId} onChange={(e) => setDraft({ ...draft, stageId: e.target.value })} style={inp}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={lbl}>Action</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={chip(draft.action === "move")} onClick={() => setDraft({ ...draft, action: "move" })}>Move to this stage</button>
            <button type="button" style={chip(draft.action === "create")} onClick={() => setDraft({ ...draft, action: "create", mode: "auto" })}>Create opportunity here</button>
          </div>
          <label style={lbl}>Triggers (pick one or more)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AUTOMATION_TRIGGERS.map((t) => {
              const on = draft.triggers.includes(t.key);
              return <button key={t.key} type="button" style={chip(on)} onClick={() => setDraft({ ...draft, triggers: on ? draft.triggers.filter((x) => x !== t.key) : [...draft.triggers, t.key] })}>{t.label}</button>;
            })}
          </div>
          {draft.triggers.length > 1 && (
            <>
              <label style={lbl}>Fire when</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={chip(draft.matchMode === "any")} onClick={() => setDraft({ ...draft, matchMode: "any" })}>Any trigger</button>
                <button type="button" style={chip(draft.matchMode === "all")} onClick={() => setDraft({ ...draft, matchMode: "all" })}>All triggers</button>
              </div>
            </>
          )}
          {draft.triggers.includes("signed_up_unpaid") && (
            <>
              <label style={lbl}>Wait this many days after signup before checking payment</label>
              <input type="number" min={0} max={90} value={draft.waitDays} onChange={(e) => setDraft({ ...draft, waitDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} style={{ ...inp, width: 90 }} />
            </>
          )}
          {draft.action === "move" && (
            <>
              <label style={lbl}>Only if the opportunity is currently in (none selected means any stage)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {stages.filter((s) => s.id !== draft.stageId).map((s) => {
                  const on = draft.fromStageIds.includes(s.id);
                  return <button key={s.id} type="button" style={chip(on)} onClick={() => setDraft({ ...draft, fromStageIds: on ? draft.fromStageIds.filter((x) => x !== s.id) : [...draft.fromStageIds, s.id] })}>{s.name}</button>;
                })}
              </div>
              <label style={lbl}>How</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={chip(draft.mode === "ask")} onClick={() => setDraft({ ...draft, mode: "ask" })}>Ask first</button>
                <button type="button" style={chip(draft.mode === "auto")} onClick={() => setDraft({ ...draft, mode: "auto" })}>Automatic</button>
              </div>
              {draft.mode === "auto" && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>A stage that starts an email sequence always asks first, whatever this says.</div>}
            </>
          )}
          <div style={{ fontSize: 12, background: "var(--muted)", borderRadius: 8, padding: 10, margin: "12px 0" }}>{summary(draft)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} style={btn(true)} onClick={() => void save()}>Save rule</button>
            <button type="button" style={btn(false)} onClick={() => setDraft(null)}>Cancel</button>
            {draft.id && <button type="button" disabled={busy} style={{ ...btn(false), color: "#A32D2D" }} onClick={() => void remove()}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}
