"use client";

// Stage 2 — pull the contact list into Verify & Append. Default view is the
// Unverified queue; pick a slice and verify just those (in addition to the
// blind next-40 runner above). Verifying updates email status inline.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListRow } from "@/lib/prospects/store";

type Filters = { status: string; side: string; search: string };
type Suggestion = { id?: string; field: "email" | "phone"; value: string; source: "site" | "email" | "profile" | "web"; confident: boolean; note: string; alternatives?: string[] };
type LawfulBasis = "legitimate_interest" | "consent" | "existing_relationship";
type ManualSource = "manual_kaspr" | "manual_apollo" | "manual_other";
type Reveal = { id: string; email: string; phone: string; source: ManualSource; saving: boolean };
type SuggState = { loading: boolean; done: boolean; suggestions: Suggestion[]; reason?: string };

const EMAIL_COLOR: Record<string, string> = { valid: "#0F6E56", risky: "#92400E", invalid: "#B91C1C", unverified: "#475569" };
const LEAD_COLOR: Record<string, string> = {
  new: "#475569", contacted: "#1A6CE4", engaged: "#0369A1", qualified: "#0F6E56",
  nurturing: "#92400E", converted: "#047857", disqualified: "#B91C1C",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "valid" only means the domain accepts mail (no mailbox check on serverless).
const EMAIL_LABEL: Record<string, string> = { valid: "Domain OK", risky: "Risky", invalid: "Invalid", unverified: "Unverified" };
const GRID = "26px 1.5fr 1fr 1fr 74px 74px 118px";
const PAGE = 50;

// LinkedIn = a people-search link (no scraping); opens the profile search in a new tab.
function linkedinSearchUrl(name: string | null, company: string | null): string {
  const q = [name, company].filter(Boolean).join(" ").trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

type VerifyResult = { processed: number; verified: number; valid: number; risky: number; invalid: number; missingEmail?: number; suppressed?: number };

function verifySummary(d: VerifyResult): string {
  const parts = [`${d.verified} verified · ${d.valid} domain OK, ${d.risky} risky, ${d.invalid} invalid`];
  if (d.missingEmail) parts.push(`${d.missingEmail} have no email (use Find missing info)`);
  if (d.suppressed) parts.push(`${d.suppressed} skipped, opted out`);
  return parts.join(" · ") + ".";
}

export function VerifyContactList() {
  const router = useRouter();
  const [f, setF] = useState<Filters>({ status: "unverified", side: "", search: "" });
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sugg, setSugg] = useState<Record<string, SuggState>>({});
  const [scopeIds, setScopeIds] = useState<string[] | null>(null);
  // Recorded on every accepted or logged value (spec 5.5). Default per decision 2026-10-06.
  const [lawfulBasis, setLawfulBasis] = useState<LawfulBasis>("legitimate_interest");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [carried, setCarried] = useState<{ name: string; count: number; hadIds: boolean } | null>(null);
  const pendingCarryRef = useRef<string[] | null>(null);
  const carryAppliedRef = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One-time: pick up the selection carried over from the Create List step.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("mh_verify_handoff"); if (raw) sessionStorage.removeItem("mh_verify_handoff"); } catch { raw = null; }
    if (!raw) return;
    try {
      const h = JSON.parse(raw) as { name: string; ids: string[] | null; count: number };
      const hasIds = Array.isArray(h.ids) && h.ids.length > 0;
      if (hasIds) { pendingCarryRef.current = h.ids as string[]; setScopeIds(h.ids as string[]); }
      setCarried({ name: h.name, count: h.count, hadIds: hasIds });
    } catch { /* ignore malformed handoff */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(PAGE) });
    if (f.status) p.set("status", f.status);
    if (f.side) p.set("side", f.side);
    if (f.search) p.set("search", f.search);
    if (scopeIds && scopeIds.length > 0) p.set("ids", scopeIds.slice(0, 1000).join(","));
    try {
      const res = await fetch(`/api/prospects/list?${p.toString()}`);
      const data = res.ok ? await res.json() : { rows: [], total: 0 };
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch { setRows([]); setTotal(0); }
    // Seed the selection from the carried ids on the first load; clear otherwise.
    if (pendingCarryRef.current && !carryAppliedRef.current) {
      setSel(new Set(pendingCarryRef.current));
      carryAppliedRef.current = true;
    } else {
      setSel(new Set());
    }
    setSugg({});
    setLoading(false);
  }, [f, scopeIds]);

  // Saved suggestions (from earlier runs, or a bulk run) come back with the page,
  // so review survives a reload.
  useEffect(() => {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;
    let live = true;
    fetch(`/api/prospects/suggestions?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((j: { suggestions?: Record<string, Suggestion[]> }) => {
        if (!live || !j.suggestions) return;
        const saved = j.suggestions;
        setSugg((p) => {
          const n = { ...p };
          for (const [id, list] of Object.entries(saved)) if (list.length && !n[id]) n[id] = { loading: false, done: true, suggestions: list };
          return n;
        });
      })
      .catch(() => { /* saved suggestions are optional */ });
    return () => { live = false; };
  }, [rows]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void load(); }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [load]);

  // Drop the carry-over scope and verify across the whole unverified queue.
  function clearCarry() {
    pendingCarryRef.current = null;
    carryAppliedRef.current = true;
    setCarried(null);
    setSel(new Set());
    setScopeIds(null);
  }

  function toggle(id: string) {
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  function toggleAll() {
    setSel(allSelected ? new Set() : new Set(pageIds));
  }

  async function verifySelected() {
    const ids = [...sel].slice(0, 100);
    if (ids.length === 0) return;
    setRunning(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/contacts/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      setMsg(verifySummary(data));
      await load();
      router.refresh(); // refresh the stat cards above
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally { setRunning(false); }
  }

  // Verify ALL unverified contacts — loops the batch endpoint until the queue drains (bounded).
  async function verifyAll() {
    setRunning(true); setError(null); setMsg(null);
    let totalDone = 0;
    try {
      for (let i = 0; i < 60; i++) { // cap ~6,000 to stay bounded
        const res = await fetch("/api/contacts/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 100 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Verification failed.");
        totalDone += data.verified ?? 0;
        setMsg(`Verifying all… ${totalDone.toLocaleString()} done · ${(data.remaining ?? 0).toLocaleString()} remaining`);
        // Stop when a batch verified nothing (only skipped rows left) or the queue is empty.
        if (!data.verified || (data.remaining ?? 0) === 0) break;
      }
      setMsg(`Done — ${totalDone.toLocaleString()} contacts verified.`);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally { setRunning(false); }
  }

  // AI find-missing — suggest missing email/phone for one contact (compliant
  // cascade: company site + licensed provider). Returns candidates, saves nothing.
  async function findMissing(id: string) {
    setSugg((p) => ({ ...p, [id]: { loading: true, done: false, suggestions: [] } }));
    try {
      const res = await fetch("/api/prospects/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed.");
      setSugg((p) => ({ ...p, [id]: { loading: false, done: true, suggestions: data.suggestions ?? [], reason: data.reason } }));
    } catch (err) {
      setSugg((p) => ({ ...p, [id]: { loading: false, done: true, suggestions: [], reason: err instanceof Error ? err.message : "Suggestion failed." } }));
    }
  }

  // Bulk AI intelligence — run find-missing across the selected contacts that
  // are missing a phone or email. Populates the same inline suggestion rows.
  async function findMissingBulk() {
    const targets = rows.filter((r) => sel.has(r.id) && (!r.phone || !r.email || (r.email_status ?? "unverified") === "invalid")).slice(0, 25);
    if (targets.length === 0) { setError(null); setMsg("None of the selected contacts are missing a phone or email."); return; }
    setRunning(true); setError(null); setMsg(null);
    let done = 0, found = 0;
    try {
      for (const t of targets) {
        setSugg((p) => ({ ...p, [t.id]: { loading: true, done: false, suggestions: [] } }));
        try {
          const res = await fetch("/api/prospects/suggest", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId: t.id }),
          });
          const data = await res.json();
          const suggestions: Suggestion[] = res.ok ? (data.suggestions ?? []) : [];
          found += suggestions.length;
          setSugg((p) => ({ ...p, [t.id]: { loading: false, done: true, suggestions, reason: res.ok ? data.reason : (data.error ?? "Suggestion failed.") } }));
        } catch {
          setSugg((p) => ({ ...p, [t.id]: { loading: false, done: true, suggestions: [], reason: "Suggestion failed." } }));
        }
        done++;
        setMsg(`Searching… ${done} of ${targets.length} · ${found} suggestion${found === 1 ? "" : "s"} found`);
      }
      setMsg(`Done — searched ${targets.length}, ${found} suggestion${found === 1 ? "" : "s"} found. Review and Accept below.`);
    } finally { setRunning(false); }
  }

  // Accept one suggestion → write it back, then drop it from the panel.
  async function acceptSugg(id: string, s: Suggestion) {
    try {
      const res = await fetch("/api/prospects/accept-suggestion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: id, field: s.field, value: s.value, source: s.source, lawfulBasis, suggestionId: s.id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Accept failed."); }
      setSugg((p) => {
        const cur = p[id]; if (!cur) return p;
        const left = cur.suggestions.filter((x) => !(x.field === s.field && x.value === s.value));
        return { ...p, [id]: { ...cur, suggestions: left, reason: left.length === 0 ? "Applied." : cur.reason } };
      });
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed.");
    }
  }

  // Reject one suggestion → saved, so it isn't offered again, then removed from the panel.
  async function rejectSugg(id: string, s: Suggestion) {
    try {
      const res = await fetch("/api/prospects/reject-suggestion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: id, field: s.field, suggestionId: s.id, value: s.value }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Reject failed."); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed.");
      return;
    }
    setSugg((p) => {
      const cur = p[id]; if (!cur) return p;
      const left = cur.suggestions.filter((x) => !(x.field === s.field && x.value === s.value));
      return { ...p, [id]: { ...cur, suggestions: left, reason: left.length === 0 ? "Dismissed." : cur.reason } };
    });
  }

  // Log a value revealed by hand in Kaspr / Apollo (spec 5.7).
  async function saveReveal() {
    if (!reveal) return;
    setReveal({ ...reveal, saving: true }); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/prospects/manual-reveal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: reveal.id, email: reveal.email || null, phone: reveal.phone || null, source: reveal.source, lawfulBasis }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed.");
      setMsg(`Saved${d.email ? ` ${d.email}` : ""}${d.email && d.phone ? " and" : ""}${d.phone ? ` ${d.phone}` : ""}.`);
      setReveal(null);
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setReveal((p) => (p ? { ...p, saving: false } : p));
    }
  }

  const sel8 = "0.5px solid var(--border)";
  const selStyle: React.CSSProperties = { fontSize: 11.5, padding: "6px 9px", borderRadius: 7, border: sel8, background: "var(--background)", color: "var(--muted-foreground)" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)", marginTop: 16 }}>
      <div style={{ padding: "11px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>Contact list</span>
        <input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Search name, email, company…" style={{ flex: 1, minWidth: 150, ...selStyle, background: "var(--background)", color: "var(--foreground)" }} />
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={{ ...selStyle, borderColor: f.status === "unverified" ? "#2E78F5" : "var(--border)", color: f.status === "unverified" ? "#1A6CE4" : "var(--muted-foreground)" }}>
          <option value="unverified">Unverified</option><option value="valid">Domain OK</option><option value="risky">Risky</option><option value="invalid">Invalid</option><option value="">Any email status</option>
        </select>
        <select value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })} style={selStyle}><option value="">All sides</option><option value="founder">Founders</option><option value="investor">Investors</option></select>
      </div>

      {/* carry-over banner — the selection brought over from Create List */}
      {carried ? (
        <div style={{ padding: "9px 14px", background: "#EEF2FF", borderBottom: "0.5px solid #C7D2FE", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#4338CA", fontSize: 13 }}><i className="ti ti-folders" aria-hidden="true" /></span>
          <span style={{ fontSize: 12, color: "#3730A3" }}>
            {carried.hadIds
              ? <>Verifying <b>“{carried.name}”</b> — {carried.count.toLocaleString()} contacts carried over and pre-selected.</>
              : <>Just created <b>“{carried.name}”</b> ({carried.count.toLocaleString()} contacts). Use <b>Verify all contacts</b> to run the whole set.</>}
          </span>
          <button type="button" onClick={clearCarry} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Verify whole queue instead</button>
        </div>
      ) : null}

      {/* selection bar */}
      <div style={{ padding: "8px 14px", background: sel.size > 0 ? "#EFF6FF" : "var(--muted)", borderBottom: sel.size > 0 ? "0.5px solid #BFDBFE" : "0.5px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "#2E78F5" }} aria-label="Select all on page" />
        <span style={{ fontSize: 11.5, color: sel.size > 0 ? "#1A4E9E" : "var(--muted-foreground)", fontWeight: 600 }}>
          {sel.size > 0 ? `${sel.size} selected` : `Select contacts to verify`}
        </span>
        <select value={lawfulBasis} onChange={(e) => setLawfulBasis(e.target.value as LawfulBasis)} title="Recorded on contacts that don't have a lawful basis yet; an existing basis is kept"
          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 7px", borderRadius: 6, border: "0.5px solid var(--border)", background: "#fff", color: "var(--foreground)" }} aria-label="Lawful basis">
          <option value="legitimate_interest">Basis: legitimate interest</option>
          <option value="existing_relationship">Basis: existing relationship</option>
          <option value="consent">Basis: consent</option>
        </select>
        <button type="button" onClick={findMissingBulk} disabled={running || sel.size === 0}
          style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#4F46E5", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: running || sel.size === 0 ? 0.5 : 1 }}
          title="Search the internet + company website for missing phone/email on the selected contacts">
          <><i className="ti ti-sparkles" aria-hidden="true" /> Find missing info ({sel.size})</>
        </button>
        <button type="button" onClick={verifyAll} disabled={running}
          style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: running ? 0.5 : 1 }}>
          {running ? "Verifying…" : <><i className="ti ti-sparkles" aria-hidden="true" /> Verify all contacts</>}
        </button>
        <button type="button" onClick={verifySelected} disabled={running || sel.size === 0}
          style={{ fontSize: 11.5, fontWeight: 700, color: "#0F6E56", background: "#fff", border: "0.5px solid #A7F3D0", borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: running || sel.size === 0 ? 0.5 : 1 }}>
          {`Verify selected (${sel.size})`}
        </button>
      </div>

      {msg ? <p style={{ margin: "8px 14px 0", background: "#ECFDF5", border: "0.5px solid #A7F3D0", color: "#065F46", fontSize: 11.5, borderRadius: 8, padding: "7px 11px" }}>{msg}</p> : null}
      {error ? <p style={{ margin: "8px 14px 0", background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 11.5, borderRadius: 8, padding: "7px 11px" }}>{error}</p> : null}

      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "8px 14px", background: "var(--muted)", borderBottom: "0.5px solid var(--border)", fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <div></div><div>Contact</div><div>Company</div><div>Phone</div><div>Email</div><div>Lead</div><div>LinkedIn</div>
      </div>

      {loading ? (
        <p style={{ padding: 28, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ padding: 28, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No contacts match these filters.</p>
      ) : rows.map((r) => {
        const es = r.email_status ?? "unverified";
        const ls = r.lead_status ?? "new";
        const missing = !r.phone || !r.email || es === "invalid";
        const s = sugg[r.id];
        return (
          <Fragment key={r.id}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "9px 14px", borderBottom: missing && s ? "none" : "0.5px solid var(--border)", alignItems: "center", fontSize: 12, background: sel.has(r.id) ? "#F5F9FF" : undefined }}>
            <div><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} style={{ accentColor: "#2E78F5" }} aria-label={`Select ${r.email ?? r.id}`} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || r.email}</div>
              {r.name ? <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div> : null}
            </div>
            <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.company ?? "—"}</div>
            <div style={{ fontSize: 10.5, fontFamily: "monospace", color: r.phone ? "var(--foreground)" : "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.phone ?? "—"}</div>
            <div><span title={es === "valid" ? "The domain accepts mail. The mailbox itself is not confirmed." : undefined} style={{ fontSize: 11, color: EMAIL_COLOR[es], fontWeight: 600 }}>{EMAIL_LABEL[es] ?? cap(es)}</span></div>
            <div><span style={{ fontSize: 10, fontWeight: 700, color: LEAD_COLOR[ls] ?? "var(--foreground)", border: "0.5px solid var(--border)", borderRadius: 6, padding: "1px 6px" }}>{cap(ls)}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <a href={linkedinSearchUrl(r.name, r.company)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, fontWeight: 700, color: "#0369A1", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ background: "#0A66C2", color: "#fff", borderRadius: 3, padding: "0 3px", fontSize: 9 }}>in</span>Find</a>
              {missing && !s ? (
                <button type="button" onClick={() => findMissing(r.id)} title="Suggest missing email/phone from the company website + licensed provider"
                  style={{ fontSize: 12, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}><i className="ti ti-sparkles" aria-hidden="true" /></button>
              ) : null}
              <button type="button" onClick={() => setReveal(reveal?.id === r.id ? null : { id: r.id, email: "", phone: "", source: "manual_kaspr", saving: false })} title="Log an email or phone you revealed in Kaspr, Apollo or elsewhere"
                style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Log</button>
              <a href={`/api/prospects/contact-data/${r.id}`} title="Download everything held on this person and where it came from"
                style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)", textDecoration: "none" }}>Data</a>
            </div>
          </div>
          {reveal?.id === r.id ? (
            <div style={{ padding: "8px 14px 10px 40px", borderBottom: "0.5px solid var(--border)", background: "#FBFCFE", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)" }}>Log a manual reveal</span>
              <input value={reveal.email} onChange={(e) => setReveal({ ...reveal, email: e.target.value })} placeholder="email" aria-label="Revealed email" style={{ ...selStyle, minWidth: 180, color: "var(--foreground)" }} />
              <input value={reveal.phone} onChange={(e) => setReveal({ ...reveal, phone: e.target.value })} placeholder="phone" aria-label="Revealed phone" style={{ ...selStyle, minWidth: 130, color: "var(--foreground)" }} />
              <select value={reveal.source} onChange={(e) => setReveal({ ...reveal, source: e.target.value as ManualSource })} aria-label="Where it came from" style={selStyle}>
                <option value="manual_kaspr">From Kaspr</option><option value="manual_apollo">From Apollo</option><option value="manual_other">Other</option>
              </select>
              <button type="button" onClick={saveReveal} disabled={reveal.saving || (!reveal.email.trim() && !reveal.phone.trim())}
                style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 5, padding: "5px 11px", cursor: "pointer", opacity: reveal.saving ? 0.5 : 1 }}>{reveal.saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setReveal(null)} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : null}
          {missing && s ? (
            <div style={{ padding: "8px 14px 10px 40px", borderBottom: "0.5px solid var(--border)", background: "#FBFCFE" }}>
              {s.loading ? (
                <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}><i className="ti ti-sparkles" aria-hidden="true" /> Searching company website & licensed provider…</span>
              ) : s.suggestions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {s.suggestions.map((sg) => (
                    <div key={`${sg.field}-${sg.value}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", width: 42 }}>{sg.field}</span>
                      <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{sg.value}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sg.confident ? "#0F6E56" : "#92400E", background: sg.confident ? "#ECFDF5" : "#FEF6E7", border: `0.5px solid ${sg.confident ? "#A7F3D0" : "#FCD9A6"}`, borderRadius: 5, padding: "1px 6px" }}>
                        {sg.note}{sg.confident ? "" : " · verify before send"}
                      </span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => acceptSugg(r.id, sg)} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 5, padding: "4px 11px", cursor: "pointer" }}>Accept</button>
                        <button type="button" onClick={() => rejectSugg(r.id, sg)} style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 5, padding: "4px 11px", cursor: "pointer" }}>Reject</button>
                      </div>
                      {sg.alternatives && sg.alternatives.length > 0 ? (
                        <details style={{ flexBasis: "100%", marginLeft: 52 }}>
                          <summary style={{ fontSize: 10.5, color: "var(--muted-foreground)", cursor: "pointer" }}>Other formats ({sg.alternatives.length})</summary>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {sg.alternatives.map((alt) => (
                              <button key={alt} type="button" onClick={() => acceptSugg(r.id, { ...sg, value: alt, alternatives: undefined })} title="Accept this format instead (saved as risky until confirmed)"
                                style={{ fontSize: 11, fontFamily: "monospace", color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>{alt}</button>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{s.reason ?? "No candidates found."}</span>
              )}
            </div>
          ) : null}
          </Fragment>
        );
      })}

      <p style={{ padding: "9px 14px", fontSize: 11.5, color: "var(--muted-foreground)" }}>
        {total.toLocaleString()} match · showing first {rows.length}. Verify runs up to 100 selected at a time; use the next-40 runner above to drain the whole queue.
      </p>
    </div>
  );
}
