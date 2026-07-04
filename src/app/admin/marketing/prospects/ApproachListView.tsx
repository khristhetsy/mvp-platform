"use client";

// Step 3 · AI Approach — list-scoped line view. Pick a saved list, select contacts,
// run the approach model, then expand any line for details + approach advice.

import { useCallback, useEffect, useState } from "react";
import type { SavedList } from "@/lib/prospects/saved-lists";
import type { ApproachAdvice } from "@/lib/approach/advice";

type Row = {
  id: string; name: string | null; email: string | null; company: string | null;
  side: string | null; segment: string | null; lead_prescore: number | null;
  lead_status: string | null; email_status: string | null; phone: string | null;
  advice: ApproachAdvice;
};

const SEG_COLOR: Record<string, string> = { hot: "#B91C1C", warm: "#92400E", cold: "#475569" };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const GRID = "26px 1.7fr 1.2fr 62px 50px 130px 20px";

export function ApproachListView() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [listId, setListId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prospects/lists").then((r) => (r.ok ? r.json() : [])).then((d) => {
      const arr = Array.isArray(d) ? d : [];
      setLists(arr);
      setListId((cur) => cur || (arr[0]?.id ?? ""));
    }).catch(() => {});
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/prospects/lists/${id}/contacts`);
      const data = res.ok ? await res.json() : { rows: [] };
      const rws = (data.rows ?? []) as Row[];
      setRows(rws);
      setSel(new Set(rws.map((r) => r.id)));
    } catch { setRows([]); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load contacts when the selected list changes
  useEffect(() => { if (listId) void load(listId); }, [listId, load]);

  function toggleSel(id: string) { setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleOpen(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function run() {
    const ids = [...sel].slice(0, 1000);
    if (ids.length === 0) return;
    setRunning(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/contacts/approach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactIds: ids }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scoring failed.");
      setMsg(`${data.processed} scored · ${data.hot} hot, ${data.warm} warm, ${data.cold} cold.`);
      await load(listId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed.");
    } finally { setRunning(false); }
  }

  const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)", overflow: "hidden" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Working on list:</span>
        <select value={listId} onChange={(e) => setListId(e.target.value)} style={{ fontSize: 12.5, fontWeight: 600, border: "1px solid #2E78F5", background: "#EFF6FF", color: "#1A6CE4", borderRadius: 7, padding: "6px 10px" }}>
          {lists.length === 0 ? <option value="">No lists yet</option> : lists.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.contact_count.toLocaleString()}</option>)}
        </select>
      </div>

      {lists.length === 0 ? (
        <p style={{ ...card, padding: 28, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>Create a list in Step 1 first, then score it here.</p>
      ) : (
        <div style={card}>
          <div style={{ padding: "8px 14px", background: sel.size > 0 ? "#EFF6FF" : "var(--muted)", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: sel.size > 0 ? "#1A4E9E" : "var(--muted-foreground)" }}>{sel.size} selected</span>
            <button onClick={run} disabled={running || sel.size === 0} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: running || sel.size === 0 ? 0.5 : 1 }}>{running ? "Scoring…" : `Run AI approach (${sel.size})`}</button>
          </div>

          {msg ? <p style={{ margin: "8px 14px 0", background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 11.5, borderRadius: 8, padding: "7px 11px" }}>{msg}</p> : null}
          {error ? <p style={{ margin: "8px 14px 0", background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 11.5, borderRadius: 8, padding: "7px 11px" }}>{error}</p> : null}

          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", borderBottom: "0.5px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>
            <div></div><div>Contact</div><div>Company</div><div>Segment</div><div>Score</div><div>Approach</div><div></div>
          </div>

          {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No contacts in this list.</p>
          : rows.map((r) => {
            const seg = r.segment ?? "cold";
            const isOpen = open.has(r.id);
            return (
              <div key={r.id}>
                <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "9px 14px", borderBottom: isOpen ? "none" : "0.5px solid var(--border)", alignItems: "center", fontSize: 12, background: isOpen ? "#F5F9FF" : sel.has(r.id) ? "#FAFCFF" : undefined }}>
                  <div><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} style={{ accentColor: "#2E78F5" }} /></div>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || r.email}</div><div style={{ fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div></div>
                  <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.company ?? "—"}</div>
                  <div><span style={{ fontSize: 11, fontWeight: 700, color: SEG_COLOR[seg] }}>{cap(seg)}</span></div>
                  <div style={{ fontWeight: 700 }}>{typeof r.lead_prescore === "number" ? r.lead_prescore : "—"}</div>
                  <div style={{ fontSize: 11, color: "#1A6CE4", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.advice.hook ? "Scored" : "Not scored"}</div>
                  <button onClick={() => toggleOpen(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", transform: isOpen ? "rotate(90deg)" : "none" }}>▸</button>
                </div>
                {isOpen ? (
                  <div style={{ padding: "0 14px 13px 40px", background: "#F5F9FF", borderBottom: "0.5px solid var(--border)" }}>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", padding: "2px 0 9px" }}>
                      {[r.side ? cap(r.side) : null, r.lead_status ? `Lead: ${cap(r.lead_status)}` : null, r.email_status ? `Email: ${cap(r.email_status)}` : null, r.phone ? "Has phone" : null].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span>✨</span><span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#1A6CE4" }}>AI approach advice</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <div style={{ gridColumn: "1 / -1", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Angle</div><div style={{ fontSize: 11.5 }}>{r.advice.angle}</div></div>
                      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Channel</div><div style={{ fontSize: 11.5 }}>{r.advice.channel}</div></div>
                      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Next step</div><div style={{ fontSize: 11.5 }}>{r.advice.nextStep}</div></div>
                      {r.advice.hook ? <div style={{ gridColumn: "1 / -1", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Hook</div><div style={{ fontSize: 11.5, fontStyle: "italic" }}>{r.advice.hook}</div></div> : null}
                      <div style={{ gridColumn: "1 / -1", background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#991B1B" }}>Watch-outs</div><div style={{ fontSize: 11, color: "#7F1D1D" }}>{r.advice.watchOuts}</div></div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          <p style={{ padding: "9px 14px", fontSize: 11, color: "var(--muted-foreground)" }}>Scores up to 1,000 selected at a time. Advice summarizes the computed approach — no invented specifics; compliance watch-out always shown.</p>
        </div>
      )}
    </div>
  );
}
