"use client";

/**
 * Task form › Matching tab: the Odoo selection bar ("N selected → Select all M ×") and
 * its Actions menu for the checked investors — Email (the shared mass-email dialog with a
 * rendered preview and the project's merge tags), Enroll in sequence (IR auto sequences),
 * Move to stage, Assign owner, Mark intro sent, Export CSV, Remove from project.
 * Each action reuses the per-record IR endpoints, one call per investor.
 */
import { useState } from "react";
import { SelectionBar, ActionResult, type SelectionAction } from "@/components/admin/sales/SelectionBar";
import { MassEmailComposer } from "@/components/marketing/MassEmailComposer";
import { downloadCsv } from "@/components/admin/ToolbarGear";
import { SEQUENCE_TEMPLATES } from "@/lib/ir/sequence-templates";
import { IR_STAGES, IR_STAGE_LABEL, type IrMatch, type IrProject } from "@/lib/ir/types";
import type { EntrepreneurProfile } from "@/lib/ir/db";

type Contact = { email: string | null; phone: string | null; country: string | null; membership: string | null };

export function MatchBulkActions({ matches, contacts, project, entrepreneur, staff, selected, setSelected, onChange }: {
  matches: IrMatch[]; contacts: Record<string, Contact>; project: IrProject; entrepreneur: EntrepreneurProfile | null;
  staff: Array<{ id: string; name: string }>; selected: Set<string>; setSelected: (s: Set<string>) => void; onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [composer, setComposer] = useState<null | "once" | "sequence">(null);
  const picked = matches.filter((m) => selected.has(m.id));

  /** Runs one request per picked investor; returns how many succeeded. */
  async function each(run: (m: IrMatch) => Promise<Response>, list: IrMatch[] = picked): Promise<number> {
    let ok = 0;
    for (const m of list) { try { if ((await run(m)).ok) ok++; } catch { /* counted as failed */ } }
    return ok;
  }
  async function bulk(label: string, run: (m: IrMatch) => Promise<Response>, clear = false) {
    setBusy(true); setResult(null);
    try {
      const n = picked.length;
      const ok = await each(run);
      setResult(ok === n ? `${label} ${ok} investor${ok === 1 ? "" : "s"}.` : `${label} ${ok} of ${n}; ${n - ok} failed.`);
      if (clear) setSelected(new Set());
      await onChange();
    } finally { setBusy(false); }
  }
  const patch = (body: Record<string, unknown>) => (m: IrMatch) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const introSent = (m: IrMatch) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "intro_sent" }) });

  function exportCsv() {
    downloadCsv(`${project.title.replace(/[^\w-]+/g, "_")}_investors.csv`, ["Name", "Company", "Email", "Phone", "Country", "Stage", "Fit tier", "Data source", "Assignee"],
      picked.map((m) => { const c = contacts[m.investor_contact_id]; return [m.investor_name, m.investor_firm, c?.email, c?.phone, c?.country, IR_STAGE_LABEL[m.stage], m.fit_tier, m.data_source, m.assignee_name]; }));
    setResult(`Exported ${picked.length} investor${picked.length === 1 ? "" : "s"}.`);
  }

  const actions: SelectionAction[] = [
    { key: "email", icon: "ti-mail", label: "Email", run: () => setComposer("once") },
    { key: "enroll", icon: "ti-send", label: "Enroll in sequence", run: () => setComposer("sequence") },
    { key: "stage", icon: "ti-arrow-right", label: "Move to stage", options: IR_STAGES.map((s) => ({ value: s, label: IR_STAGE_LABEL[s] })), runWith: (stage) => void bulk(`Moved to ${IR_STAGE_LABEL[stage as keyof typeof IR_STAGE_LABEL]}:`, patch({ stage })) },
    { key: "owner", icon: "ti-user", label: "Assign owner", options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))], runWith: (id) => void bulk("Reassigned", patch({ assigneeId: id || null })) },
    { key: "intro", icon: "ti-circle-check", label: "Mark intro sent", run: () => void bulk("Marked intro sent for", introSent) },
    { key: "export", icon: "ti-download", label: "Export CSV", run: exportCsv },
    { key: "remove", icon: "ti-x", label: "Remove from project", danger: true, run: () => {
      if (!window.confirm(`Remove ${picked.length} investor${picked.length === 1 ? "" : "s"} from ${project.title}? Their activities and stage history on this project go too.`)) return;
      void bulk("Removed", (m) => fetch(`/api/admin/ir/matches/${m.id}`, { method: "DELETE" }), true);
    } },
  ];

  // Project-level merge tags, filled in before the send; {{first_name}} / {{company}} stay per investor.
  const e = entrepreneur;
  const extraMerge: Record<string, string> = {
    founder_name: e?.founder ?? project.founder_name ?? "",
    founder_company: e?.company ?? project.title,
    raise: e?.raise ?? "",
    stage: e?.stage ?? "",
    sectors: e?.industry ?? "",
  };
  const withEmail = picked.filter((m) => contacts[m.investor_contact_id]?.email);
  const previewAs = withEmail.map((m) => ({ label: m.investor_name ?? m.investor_firm ?? "Investor", first_name: (m.investor_name ?? "").trim().split(/\s+/)[0] || "there", company: m.investor_firm ?? "" }));

  return (
    <>
      <SelectionBar count={selected.size} total={matches.length} onSelectAll={() => setSelected(new Set(matches.map((m) => m.id)))} onClear={() => setSelected(new Set())} actions={actions} busy={busy} heading="Selected investors" />
      <ActionResult text={result} onClose={() => setResult(null)} />
      {composer ? (
        <MassEmailComposer
          source="contacts" noun="investor" initialMode={composer}
          selection={{ mode: "ids", ids: [...new Set(picked.map((m) => m.investor_contact_id))], count: picked.length }}
          extraMerge={extraMerge} previewAs={previewAs}
          renderSequence={(done) => <IrSequencePanel matchIds={picked.map((m) => m.id)} staff={staff} ownerId={project.owner_id} onDone={(msg) => { done(msg); void onChange(); }} />}
          onSent={(sent) => {
            // A sent intro completes each still-Matched investor's "Send intro email" to-do.
            if (sent > 0) void each(introSent, withEmail.filter((m) => m.stage === "matched")).then(() => onChange());
          }}
          onClose={() => { setComposer(null); void onChange(); }}
        />
      ) : null}
    </>
  );
}

/** Enroll in sequence for IR: the auto sequences the matching queue starts, on the picked investors. */
function IrSequencePanel({ matchIds, staff, ownerId, onDone }: { matchIds: string[]; staff: Array<{ id: string; name: string }>; ownerId: string; onDone: (msg: string) => void }) {
  const [template, setTemplate] = useState(Object.keys(SEQUENCE_TEMPLATES)[0]);
  const [via, setVia] = useState<"icapos" | "gmail">("icapos");
  const [manager, setManager] = useState(staff.some((s) => s.id === ownerId) ? ownerId : staff[0]?.id ?? "");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sel = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", width: "100%", boxSizing: "border-box" as const, marginBottom: 10 };
  async function start() {
    if (!manager) { setErr("Pick an account manager."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/admin/ir/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchIds, template, via, managerId: manager, notifyEmail }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? "Couldn't start the sequence."); return; }
      const skipped = (j.skipped ?? []).length;
      onDone(`Started ${j.started ?? 0} on ${SEQUENCE_TEMPLATES[template]?.name ?? "the sequence"}${skipped ? `, ${skipped} skipped` : ""}. The first emails go out within 15 minutes.`);
    } finally { setBusy(false); }
  }
  return (
    <>
      <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Sequence</p>
      <select value={template} onChange={(e) => setTemplate(e.target.value)} style={sel}>
        {Object.entries(SEQUENCE_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name} · {t.steps.length} steps (days {t.steps.map((s) => s.day).join(", ")})</option>)}
      </select>
      <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Account manager to alert</p>
      <select value={manager} onChange={(e) => setManager(e.target.value)} style={sel}>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 16, fontSize: 12.5, marginBottom: 8 }}>
        {(["icapos", "gmail"] as const).map((k) => <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" name="ir-bulk-via" checked={via === k} onChange={() => setVia(k)} /> {k === "icapos" ? "iCapOS" : "Gmail"}</label>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} /> Email the alerts too (always in iCapOS notifications)</label>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: "8px 11px", margin: "0 0 12px", lineHeight: 1.5 }}>
        Alerts on opens, clicks, replies and meetings; stops on a reply or meeting.{via === "gmail" ? " Opens and clicks can’t be tracked on Gmail sends." : ""}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: err ? "#A32D2D" : "var(--muted-foreground)" }}>{err ?? "Investors already on a sequence are skipped."}</span>
        <button type="button" onClick={() => void start()} disabled={busy || !manager} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Starting…" : `Enroll · ${matchIds.length}`}
        </button>
      </div>
    </>
  );
}
