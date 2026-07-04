"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Filters = { side: string; segment: string; status: string; leadStatus: string; source: string; minScore: string; search: string };
type Counts = { total: number; hot: number; warm: number; cold: number; valid: number };
type ListOpt = { id: string; name: string };

const EMPTY: Filters = { side: "", segment: "", status: "", leadStatus: "", source: "", minScore: "", search: "" };

const LEAD_STATUS_OPTS: Array<[string, string]> = [
  ["new", "New"], ["contacted", "Contacted"], ["engaged", "Engaged"], ["qualified", "Qualified"],
  ["nurturing", "Nurturing"], ["converted", "Converted"], ["disqualified", "Disqualified"],
];

export function FilterSaveList() {
  const router = useRouter();
  const [f, setF] = useState<Filters>(EMPTY);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListOpt[]>([]);
  const [name, setName] = useState("");
  const [existing, setExisting] = useState("");
  const [saving, setSaving] = useState<null | "new" | "add">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/marketing/lists").then((r) => (r.ok ? r.json() : [])).then((d) => setLists(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- debounced live match count */
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const p = new URLSearchParams();
      if (f.side) p.set("side", f.side);
      if (f.segment) p.set("segment", f.segment);
      if (f.status) p.set("status", f.status);
      if (f.leadStatus) p.set("leadStatus", f.leadStatus);
      if (f.source) p.set("source", f.source);
      if (f.minScore) p.set("minScore", f.minScore);
      if (f.search) p.set("search", f.search);
      try {
        const res = await fetch(`/api/prospects/list-count?${p.toString()}`);
        setCounts(res.ok ? await res.json() : null);
      } catch { setCounts(null); }
      setLoading(false);
    }, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [f]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function filterBody() {
    return {
      side: f.side || undefined, segment: f.segment || undefined, status: f.status || undefined,
      leadStatus: f.leadStatus || undefined,
      source: f.source || undefined, minScore: f.minScore ? Number(f.minScore) : undefined, search: f.search || undefined,
    };
  }

  async function save(kind: "new" | "add") {
    setSaving(kind); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/prospects/save-list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "new" ? { filters: filterBody(), name } : { filters: filterBody(), listId: existing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setMsg(`Saved ${data.added.toLocaleString()} contacts to “${data.listName}”.`);
      if (kind === "new") setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(null); }
  }

  const label: React.CSSProperties = { fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", fontWeight: 700, display: "block", marginBottom: 4 };
  const sel: React.CSSProperties = { fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 7, padding: "7px 9px", width: "100%", background: "var(--background)", color: "var(--foreground)" };
  const leadLabel = (v: string) => LEAD_STATUS_OPTS.find(([k]) => k === v)?.[1] ?? v;
  const active = [f.side && `side: ${f.side}`, f.segment && `segment: ${f.segment}`, f.status && `email: ${f.status}`, f.leadStatus && `lead: ${leadLabel(f.leadStatus)}`, f.source && `source: ${f.source}`, f.minScore && `score ≥ ${f.minScore}`, f.search && `“${f.search}”`].filter(Boolean) as string[];

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
      <h3 style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Filter &amp; save a contact list</h3>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>Narrow the pipeline, watch the numbers, then save the slice as a list Campaigns can target.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
        <div><label style={label}>Side</label><select value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })} style={sel}><option value="">Any</option><option value="founder">Founders</option><option value="investor">Investors</option></select></div>
        <div><label style={label}>Segment</label><select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} style={sel}><option value="">Any</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></div>
        <div><label style={label}>Email status</label><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={sel}><option value="">Any</option><option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option><option value="unverified">Unverified</option></select></div>
        <div><label style={{ ...label, color: "#1A6CE4" }}>Lead status</label><select value={f.leadStatus} onChange={(e) => setF({ ...f, leadStatus: e.target.value })} style={{ ...sel, borderColor: f.leadStatus ? "#2E78F5" : "var(--border)" }}><option value="">Any</option>{LEAD_STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label style={label}>Source</label><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} style={sel}><option value="">Any</option><option value="odoo">Odoo</option><option value="manual">Manual</option><option value="csv">File (CSV)</option><option value="icapos">iCapOS signup</option></select></div>
        <div><label style={label}>Pre-score ≥</label><select value={f.minScore} onChange={(e) => setF({ ...f, minScore: e.target.value })} style={sel}><option value="">Any</option><option value="40">40</option><option value="55">55</option><option value="65">65</option><option value="80">80</option></select></div>
        <div><label style={label}>Search</label><input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="name, email, company" style={{ ...sel, background: "var(--background)" }} /></div>
      </div>

      {active.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Active:</span>
          {active.map((a) => <span key={a} style={{ fontSize: 10.5, background: "#EFF6FF", color: "#1A6CE4", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>{a}</span>)}
          <button onClick={() => setF(EMPTY)} style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>Clear all</button>
        </div>
      )}

      {/* Live count */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, border: "0.5px solid var(--border)", borderRadius: 10, background: "var(--muted)", padding: "11px 14px", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1A6CE4", lineHeight: 1 }}>{loading ? "…" : (counts?.total ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>match</div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5 }}>
          <div><div style={{ fontWeight: 700, color: "#B91C1C" }}>{(counts?.hot ?? 0).toLocaleString()}</div><div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Hot</div></div>
          <div><div style={{ fontWeight: 700, color: "#92400E" }}>{(counts?.warm ?? 0).toLocaleString()}</div><div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Warm</div></div>
          <div><div style={{ fontWeight: 700, color: "var(--muted-foreground)" }}>{(counts?.cold ?? 0).toLocaleString()}</div><div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Cold</div></div>
          <div style={{ borderLeft: "0.5px solid var(--border)", paddingLeft: 14 }}><div style={{ fontWeight: 700, color: "#0F6E56" }}>{(counts?.valid ?? 0).toLocaleString()}</div><div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Valid email</div></div>
        </div>
      </div>

      {msg ? <p style={{ background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{msg}</p> : null}
      {error ? <p style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{error}</p> : null}

      {/* Save / assign */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this list — e.g. SaaS founders · valid email" style={{ flex: 1, minWidth: 200, ...sel }} />
        <button onClick={() => save("new")} disabled={saving !== null || !name.trim() || !counts?.total}
          style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "9px 15px", cursor: "pointer", opacity: saving !== null || !name.trim() || !counts?.total ? 0.5 : 1 }}>
          {saving === "new" ? "Saving…" : "Save as new list"}
        </button>
      </div>
      {lists.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>or add to</span>
          <select value={existing} onChange={(e) => setExisting(e.target.value)} style={{ ...sel, width: "auto", minWidth: 200 }}>
            <option value="">Choose a list…</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={() => save("add")} disabled={saving !== null || !existing || !counts?.total}
            style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "8px 13px", cursor: "pointer", opacity: saving !== null || !existing || !counts?.total ? 0.5 : 1 }}>
            {saving === "add" ? "Adding…" : "Add to list"}
          </button>
        </div>
      )}
    </div>
  );
}
