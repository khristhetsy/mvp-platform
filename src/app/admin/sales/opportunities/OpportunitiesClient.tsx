"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = { id: string; title: string; contact_name: string | null; contact_email: string | null; stage_id: string | null; stage_name: string | null; value_cents: number | null; status: "open" | "won" | "lost" | "archived"; notes: string | null; created_at: string };

const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  open: { text: "Open", color: "#185FA5", bg: "#E6F1FB" },
  won: { text: "Won", color: "#0F6E56", bg: "#E1F5EE" },
  lost: { text: "Lost", color: "#A32D2D", bg: "#FCEBEB" },
  archived: { text: "Archived", color: "#5F5E5A", bg: "#F1EFE8" },
};
const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
const GRID = "1.6fr 1.2fr 1fr 90px 300px";

export function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", value: "", notes: "" });
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [email, setEmail] = useState({ subject: "", body: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/opportunities${showArchived ? "?archived=1" : ""}`);
      const data = res.ok ? await res.json() : { opportunities: [], stages: [] };
      setOpps(data.opportunities ?? []);
      setStages(data.stages ?? []);
    } catch { setOpps([]); }
    setLoading(false);
  }, [showArchived]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / toggle
  useEffect(() => { void load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try { await fetch(`/api/sales/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await load(); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this opportunity permanently?")) return;
    setBusy(true);
    try { await fetch(`/api/sales/opportunities/${id}`, { method: "DELETE" }); await load(); }
    finally { setBusy(false); }
  }
  function startEdit(o: Opp) { setEditing(o.id); setDraft({ title: o.title, value: o.value_cents != null ? String(o.value_cents / 100) : "", notes: o.notes ?? "" }); }
  async function saveEdit(id: string) {
    await patch(id, { title: draft.title, valueCents: draft.value ? Math.round(Number(draft.value) * 100) : null, notes: draft.notes });
    setEditing(null);
  }
  function openEmail(o: Opp) { setEmailFor(o.id); setEmail({ subject: `Following up — ${o.title}`, body: `Hi ${o.contact_name ?? "there"},\n\n` }); }
  async function saveDraftEmail(o: Opp) {
    const stamp = `\n\n[Email draft ${new Date().toLocaleDateString()}] ${email.subject}\n${email.body}`;
    await patch(o.id, { notes: (o.notes ?? "") + stamp });
    setEmailFor(null);
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, color, background: bg, border: bg === "#fff" ? "0.5px solid var(--border-strong, #cbd5e1)" : "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{opps.length} opportunit{opps.length === 1 ? "y" : "ies"}</span>
        <button onClick={() => setShowArchived((v) => !v)} style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>{showArchived ? "Hide archived" : "Show archived"}</button>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Opportunity</div><div>Stage</div><div>Value</div><div>Status</div><div></div>
        </div>
        {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : opps.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No opportunities yet. Convert a contact from the Contacts tab.</p>
          : opps.map((o) => (
            <Fragment key={o.id}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 14px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12.5 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.contact_email ?? o.contact_name ?? "—"}</div>
                </div>
                <div>
                  <select value={o.stage_id ?? ""} onChange={(e) => patch(o.id, { stageId: e.target.value })} disabled={busy || o.status === "archived"} style={{ ...inp, maxWidth: 150 }}>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ color: "var(--muted-foreground)" }}>{money(o.value_cents)}</div>
                <div><span style={{ fontSize: 10, fontWeight: 600, color: STATUS[o.status].color, background: STATUS[o.status].bg, borderRadius: 10, padding: "2px 8px" }}>{STATUS[o.status].text}</span></div>
                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {o.status === "open" && <button onClick={() => patch(o.id, { status: "won" })} disabled={busy} style={btn("#0F6E56")}>Mark sold</button>}
                  <button onClick={() => openEmail(o)} style={btn("#fff", "#185FA5")}>Email</button>
                  <button onClick={() => startEdit(o)} style={btn("#fff", "var(--muted-foreground)")}>Edit</button>
                  {o.status !== "archived" && <button onClick={() => patch(o.id, { status: "archived" })} disabled={busy} style={btn("#fff", "var(--muted-foreground)")}>Archive</button>}
                  <button onClick={() => del(o.id)} disabled={busy} style={btn("#fff", "#A32D2D")}>Delete</button>
                </div>
              </div>

              {editing === o.id && (
                <div style={{ padding: "12px 14px", borderTop: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "start" }}>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" style={inp} />
                  <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Value ($)" inputMode="decimal" style={inp} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => saveEdit(o.id)} disabled={busy} style={btn("#0F6E56")}>Save</button>
                    <button onClick={() => setEditing(null)} style={{ ...btn("#fff", "var(--muted-foreground)") }}>Cancel</button>
                  </div>
                  <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" rows={2} style={{ ...inp, gridColumn: "1 / -1", resize: "vertical" }} />
                </div>
              )}

              {emailFor === o.id && (
                <div style={{ padding: "12px 14px", borderTop: "0.5px solid #eef1f5", background: "#FBFCFE" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6 }}>Draft email · to {o.contact_email ?? o.contact_name}</div>
                  <input value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} placeholder="Subject" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 6 }} />
                  <textarea value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} rows={4} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <button onClick={() => saveDraftEmail(o)} disabled={busy} style={btn("#2E78F5")}>Save draft</button>
                    <button onClick={() => setEmailFor(null)} style={btn("#fff", "var(--muted-foreground)")}>Cancel</button>
                    <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>Drafts don&rsquo;t send — sending routes through the approved pipeline.</span>
                  </div>
                </div>
              )}
            </Fragment>
          ))}
      </div>
    </div>
  );
}
