"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = {
  id: string; title: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; expected_close: string | null;
  priority: number; tags: string[]; source: string | null; lead_status: string | null;
  status: "open" | "won" | "lost" | "archived"; notes: string | null;
  lead_assignees: string[];
};

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const cardBox: React.CSSProperties = { background: "var(--muted)", borderRadius: 8, padding: 11 };

export function OpportunityDetailClient({ initial, stages }: { initial: Opp; stages: Stage[] }) {
  const router = useRouter();
  const [o, setO] = useState<Opp>(initial);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"notes" | "extra">("notes");
  const [noteInput, setNoteInput] = useState("");

  async function saveNote() {
    const text = noteInput.trim();
    if (!text) return;
    const stamp = `[${new Date().toISOString().slice(0, 10)}] ${text}`;
    const next = o.notes ? `${o.notes}\n${stamp}` : stamp;
    await patch({ notes: next });
    setNoteInput("");
  }
  const [draft, setDraft] = useState({
    title: initial.title, value: initial.value_cents != null ? String(initial.value_cents / 100) : "",
    billing: initial.billing, probability: initial.probability != null ? String(initial.probability) : "",
    expected_close: initial.expected_close ?? "", source: initial.source ?? "", notes: initial.notes ?? "",
  });

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/sales/opportunities/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const res = await fetch(`/api/sales/opportunities/${o.id}`);
      if (res.ok) setO((await res.json()).opportunity);
    } finally { setBusy(false); }
  }
  async function saveEdit() {
    await patch({
      title: draft.title,
      valueCents: draft.value ? Math.round(Number(draft.value) * 100) : null,
      billing: draft.billing,
      probability: draft.probability ? Number(draft.probability) : null,
      expectedClose: draft.expected_close || null,
      source: draft.source || null,
      notes: draft.notes,
    });
    setEditing(false);
  }
  async function del() {
    if (!confirm("Delete this opportunity permanently?")) return;
    setBusy(true);
    await fetch(`/api/sales/opportunities/${o.id}`, { method: "DELETE" });
    router.push("/admin/sales/opportunities");
  }
  function logTouch(channel: "call" | "email" | "message") {
    void fetch(`/api/sales/opportunities/${o.id}/touch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
  }

  const currentSort = stages.find((s) => s.id === o.stage_id)?.sort_order ?? -1;
  const wonStage = stages.find((s) => s.is_won);
  const nextStage = stages.find((s) => s.sort_order > currentSort && !s.is_won);
  const statusColor = o.status === "won" ? "#0F6E56" : o.status === "lost" ? "#A32D2D" : o.status === "archived" ? "#5F5E5A" : "#185FA5";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/sales/opportunities" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Opportunities</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{o.title}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          {wonStage && o.status === "open" && <button onClick={() => patch({ status: "won", stageId: wonStage.id })} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>✓ Won</button>}
          {o.status === "open" && <button onClick={() => patch({ status: "lost" })} disabled={busy} style={{ fontSize: 12, color: "#A32D2D", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>Lost</button>}
          {o.status !== "open" && <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor, background: "var(--muted)", borderRadius: 10, padding: "5px 12px" }}>{o.status.toUpperCase()}</span>}
          <div style={{ width: 8 }} />
          {o.contact_phone && <a href={`tel:${o.contact_phone.replace(/[^+\d]/g, "")}`} onClick={() => logTouch("call")} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-phone" aria-hidden="true" /> Call</a>}
          {o.contact_email && <a href={`/admin/inbox?compose=1&to=${encodeURIComponent(o.contact_email)}`} onClick={() => logTouch("email")} style={{ fontSize: 11.5, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email</a>}
          {o.contact_phone && <a href={`sms:${o.contact_phone.replace(/[^+\d]/g, "")}`} onClick={() => logTouch("message")} style={{ fontSize: 11.5, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Message</a>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setEditing((v) => !v)} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>{editing ? "Close edit" : "Edit"}</button>
          {nextStage && o.status === "open" && <button onClick={() => patch({ stageId: nextStage.id })} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>Advance →</button>}
          <button onClick={del} disabled={busy} style={{ fontSize: 12, color: "#A32D2D", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>Delete</button>
        </div>

        {/* Stage bar */}
        <div style={{ display: "flex", padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", overflowX: "auto" }}>
          {stages.map((s, i) => {
            const active = s.id === o.stage_id;
            const done = s.sort_order < currentSort;
            return (
              <button key={s.id} onClick={() => patch({ stageId: s.id })} disabled={busy}
                style={{ fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", border: "none",
                  color: active ? "#fff" : done ? "#0F6E56" : "var(--muted-foreground)",
                  background: active ? "#2E78F5" : s.is_won ? "#E1F5EE" : "var(--muted)",
                  padding: "6px 14px", borderRadius: i === 0 ? "6px 0 0 6px" : i === stages.length - 1 ? "0 6px 6px 0" : 0,
                  borderLeft: i === 0 ? "none" : "0.5px solid #fff" }}>
                {s.name}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>
          {editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Title</label><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Value ($)</label><input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} inputMode="decimal" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Billing</label><select value={draft.billing} onChange={(e) => setDraft({ ...draft, billing: e.target.value as "yearly" | "monthly" })} style={{ ...inp, width: "100%", marginTop: 4 }}><option value="yearly">Yearly</option><option value="monthly">Monthly</option></select></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Probability (%)</label><input value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} inputMode="numeric" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected close</label><input type="date" value={draft.expected_close} onChange={(e) => setDraft({ ...draft, expected_close: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Source</label><input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
                <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{o.title}</div>
                <div style={{ display: "flex", gap: 2, color: "#EF9F27", fontSize: 16, cursor: "pointer" }}>
                  {[1, 2, 3].map((n) => <span key={n} onClick={() => patch({ priority: o.priority === n ? 0 : n })} style={{ color: n <= o.priority ? "#EF9F27" : "var(--muted-foreground)" }}>★</span>)}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Deal value</div><div style={{ fontSize: 19, fontWeight: 600 }}>{money(o.value_cents)}<span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>/{o.billing === "monthly" ? "mo" : "yr"}</span></div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected MRR</div><div style={{ fontSize: 19, fontWeight: 600 }}>{mrr(o)}</div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Close probability</div><div style={{ fontSize: 19, fontWeight: 600, color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected close</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>{o.expected_close ?? "—"}</div></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
                {[
                  ["Contact", o.contact_name ?? "—"], ["Email", o.contact_email ?? "—"],
                  ["Stage", o.stage_name ?? "—"], ["Source", o.source ?? "—"],
                  ["Lead status", o.lead_status ?? "—"], ["Billing", o.billing === "monthly" ? "Monthly" : "Yearly"],
                  ["Lead assign", o.lead_assignees.length ? o.lead_assignees.join(", ") : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
                    <span style={{ color: k === "Email" ? "#185FA5" : "var(--foreground)", fontWeight: k === "Contact" ? 500 : 400 }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Notes / extra tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid #eef1f5", margin: "16px 0 12px" }}>
            <button onClick={() => setTab("notes")} style={{ fontSize: 12, fontWeight: tab === "notes" ? 600 : 400, color: tab === "notes" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "notes" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Internal notes</button>
            <button onClick={() => setTab("extra")} style={{ fontSize: 12, fontWeight: tab === "extra" ? 600 : 400, color: tab === "extra" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "extra" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Extra info</button>
          </div>
          {tab === "notes" ? (
            <div>
              <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 48, resize: "vertical" }} />
              <div style={{ margin: "6px 0 12px" }}>
                <button onClick={saveNote} disabled={busy || !noteInput.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !noteInput.trim() ? 0.5 : 1 }}>Save note</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: 11, whiteSpace: "pre-wrap", lineHeight: 1.6, minHeight: 40 }}>{o.notes || "No notes yet."}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted-foreground)" }}>Tags</span><span>{o.tags.length ? o.tags.join(", ") : "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted-foreground)" }}>Priority</span><span>{o.priority ? `${o.priority}★` : "—"}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
