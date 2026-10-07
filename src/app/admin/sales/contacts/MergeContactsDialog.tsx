"use client";

/**
 * Merge dialog: pick the record to keep and, per field, whose value survives. Defaults come from
 * defaultMergeChoice (fullest profile kept, gaps filled from the others). The merge runs in one
 * transaction server side, moves every reference to the kept contact, and can be undone.
 */
import { useEffect, useMemo, useState } from "react";
import { MERGE_FIELDS, defaultMergeChoice, mergeFieldValue, type MergeCandidate, type MergeField } from "@/lib/sales/merge-contacts-shared";

export type MergeDone = { batchId: string; keptId: string; keptName: string; merged: number };

const TYPE_LABEL: Record<string, string> = { founder: "Founder", investor: "Investor", advisor: "Advisor", other: "Other" };
const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };
const secondary: React.CSSProperties = { fontSize: 12.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };

function plural(n: number, one: string, many = `${one}s`) { return `${n.toLocaleString()} ${n === 1 ? one : many}`; }

export function MergeContactsDialog({ ids, onClose, onMerged }: { ids: string[]; onClose: () => void; onMerged: (done: MergeDone) => void }) {
  const [cands, setCands] = useState<MergeCandidate[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [keepId, setKeepId] = useState("");
  const [fields, setFields] = useState<Record<MergeField, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/sales/contacts/merge?ids=${ids.map(encodeURIComponent).join(",")}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Couldn't load those contacts."); return d; })
      .then((d: { candidates: MergeCandidate[]; defaults: { keepId: string; fields: Record<MergeField, string> } }) => {
        if (!live) return;
        setCands(d.candidates); setKeepId(d.defaults.keepId); setFields(d.defaults.fields);
      })
      .catch((e) => { if (live) setLoadErr(e instanceof Error ? e.message : "Couldn't load those contacts."); });
    return () => { live = false; };
  }, [ids]);

  function pickKeep(id: string) {
    if (!cands) return;
    setKeepId(id);
    setFields(defaultMergeChoice(cands, id).fields);
  }

  // Rows where nobody has a value would only show "empty" twice: leave them out.
  const rows = useMemo(() => (cands ? MERGE_FIELDS.filter((f) => cands.some((c) => mergeFieldValue(c, f.key))) : []), [cands]);
  const others = cands?.filter((c) => c.id !== keepId) ?? [];
  const moves = others.reduce((a, c) => ({ irMatches: a.irMatches + c.refs.irMatches, lists: a.lists + c.refs.lists, projects: a.projects + c.refs.projects }), { irMatches: 0, lists: 0, projects: 0 });
  const tags = [...new Set((cands ?? []).flatMap((c) => c.tags))];

  async function submit() {
    if (!cands || !fields) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/sales/contacts/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keepId, mergeIds: others.map((c) => c.id), fields }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't merge those contacts.");
      const kept = cands.find((c) => c.id === keepId);
      const nameFrom = cands.find((c) => c.id === fields.name) ?? kept;
      onMerged({ batchId: d.batchId, keptId: keepId, keptName: nameFrom?.name || kept?.email || "the kept contact", merged: d.merged });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't merge those contacts."); setBusy(false); }
  }

  const cols = `130px repeat(${cands?.length ?? 2}, minmax(170px, 1fr))`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Merge contacts" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,64,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid var(--border-strong, #cbd5e1)", boxShadow: "0 18px 48px rgba(0,0,0,0.18)", width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid #e2e6ed" }}>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Merge contacts</span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--muted-foreground)" }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        <div style={{ padding: "14px 18px", overflow: "auto" }}>
          {loadErr && <p role="alert" style={{ fontSize: 12.5, color: "#A32D2D" }}>{loadErr}</p>}
          {!loadErr && (!cands || !fields) && <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>}
          {cands && fields && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: "8px 12px", alignItems: "center", fontSize: 12.5, minWidth: 130 + cands.length * 170 }}>
                <span />
                {cands.map((c) => {
                  const on = c.id === keepId;
                  return (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", border: on ? "2px solid #2E78F5" : "0.5px solid #d6dde8", borderRadius: 8, padding: on ? "7px 9px" : "8.5px 10.5px", background: on ? "#F5F9FF" : "#fff" }}>
                      <input type="radio" name="merge-keep" checked={on} onChange={() => pickKeep(c.id)} style={{ accentColor: "#2E78F5" }} />
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: on ? "#0C447C" : "var(--foreground)" }}>{on ? "Keep" : "Merge in"}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[c.createdOn?.slice(0, 4), c.source === "odoo" ? "Odoo" : c.source].filter(Boolean).join(" · ") || "No date"}</span>
                      </span>
                    </label>
                  );
                })}

                {rows.map((f) => (
                  <FieldRow key={f.key} label={f.label} cands={cands} field={f.key} chosen={fields[f.key]} onPick={(id) => setFields({ ...fields, [f.key]: id })} />
                ))}

                {tags.length > 0 && (
                  <>
                    <span style={{ color: "var(--muted-foreground)" }}>Tags</span>
                    <span style={{ gridColumn: "2 / -1" }}>Combined: {tags.join(", ")}</span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 14, background: "#F8FAFD", border: "0.5px solid #e2e6ed", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--muted-foreground)", display: "flex", gap: 8 }}>
                <i className="ti ti-arrows-exchange" style={{ fontSize: 15, marginTop: 1 }} aria-hidden="true" />
                <span>
                  Moves to the kept contact: {plural(moves.irMatches, "Investor Relations match", "Investor Relations matches")}, {plural(moves.lists, "marketing contact")}, {plural(moves.projects, "Investor Relations project")}. Lead assignees are combined.
                  {" "}{others.length === 1 ? "The other record is removed." : `The other ${others.length} records are removed.`} You can undo this right after.
                </span>
              </div>
              {err && <p role="alert" style={{ fontSize: 12, color: "#A32D2D", marginTop: 10 }}>{err}</p>}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 18px", borderTop: "0.5px solid #e2e6ed" }}>
          <button type="button" onClick={onClose} disabled={busy} style={secondary}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !cands || !fields} style={{ ...primary, opacity: busy || !cands ? 0.6 : 1 }}>{busy ? "Merging…" : "Merge"}</button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, cands, field, chosen, onPick }: { label: string; cands: MergeCandidate[]; field: MergeField; chosen: string; onPick: (id: string) => void }) {
  return (
    <>
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      {cands.map((c) => {
        const v = mergeFieldValue(c, field);
        if (!v) return <span key={c.id} style={{ color: "#9aa4b2", paddingLeft: 24 }}>empty</span>;
        const shown = field === "type" ? TYPE_LABEL[c.type] ?? c.type : field === "profile" ? `${v}${c.profileSummary.length ? `: ${c.profileSummary.slice(0, 3).join(", ")}` : ""}` : v;
        return (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minWidth: 0 }} title={shown}>
            <input type="radio" name={`merge-${field}`} checked={chosen === c.id} onChange={() => onPick(c.id)} style={{ accentColor: "#2E78F5", flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: chosen === c.id ? "var(--foreground)" : "var(--muted-foreground)" }}>{shown}</span>
          </label>
        );
      })}
    </>
  );
}

/** Green strip after a merge: what happened, with Undo (reverses the whole merge). */
export function MergeUndoBanner({ done, onClose, onUndone }: { done: MergeDone; onClose: () => void; onUndone: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "undone">("idle");
  const [err, setErr] = useState<string | null>(null);
  async function undo() {
    setState("busy"); setErr(null);
    try {
      const r = await fetch("/api/sales/contacts/merge/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: done.batchId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't undo that merge.");
      setState("undone"); onUndone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't undo that merge."); setState("idle"); }
  }
  const text = state === "undone"
    ? `Merge undone. ${done.merged === 1 ? "The contact is" : `${done.merged} contacts are`} back.`
    : `Merged ${done.merged === 1 ? "1 contact" : `${done.merged} contacts`} into ${done.keptName}.`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: err ? "#FCEBEB" : "#E1F5EE", border: `0.5px solid ${err ? "#F7C1C1" : "#A7E0CE"}`, borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
      <i className={`ti ${err ? "ti-alert-circle" : "ti-circle-check"}`} style={{ color: err ? "#A32D2D" : "#0F6E56" }} aria-hidden="true" />
      <span style={{ fontSize: 12.5, color: err ? "#A32D2D" : "#0F6E56", fontWeight: 500 }}>{err ?? text}</span>
      {state !== "undone" && (
        <>
          <a href={`/admin/sales/contacts/${done.keptId}`} style={{ fontSize: 12, color: "#185FA5", textDecoration: "underline" }}>Open contact</a>
          <button type="button" onClick={undo} disabled={state === "busy"} style={{ fontSize: 12, fontWeight: 600, color: "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>{state === "busy" ? "Undoing…" : "Undo"}</button>
        </>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
    </div>
  );
}
