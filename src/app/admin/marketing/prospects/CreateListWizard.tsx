"use client";

// Step 1 · Create a contact list — a 4 sub-step wizard: Source → Filter → Select → Save.
// Sources: Founder profiles (platform data) or a pipeline preset (Odoo / iCapOS signups /
// File uploads / All pipeline). Filter it, tick contacts, save a custom Marketing Hub list.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";

type Source = "founder" | "all" | "odoo" | "icapos" | "csv";
const SOURCES: Array<{ id: Source; label: string }> = [
  { id: "founder", label: "Founder profiles" },
  { id: "all", label: "All pipeline" },
  { id: "odoo", label: "Odoo" },
  { id: "icapos", label: "iCapOS signups" },
  { id: "csv", label: "File uploads" },
];
const SUB_STEPS = ["Source", "Filter", "Select", "Name & save"];

const STAGES = ["initialize", "qualify", "deploy", "optimize"];
const LEAD_STATUSES = ["new", "contacted", "engaged", "qualified", "nurturing", "converted", "disqualified"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const label: React.CSSProperties = { fontSize: 9, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 };
const sel: React.CSSProperties = { fontSize: 11.5, border: "0.5px solid var(--border)", borderRadius: 6, padding: "6px 8px", width: "100%", background: "var(--background)", color: "var(--foreground)" };

export function CreateListWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source>("founder");

  // founder + pipeline filter state
  const [ff, setFf] = useState({ stage: "", sector: "", jurisdiction: "", minReadiness: "", minFunding: "", search: "" });
  const [pf, setPf] = useState({ side: "", segment: "", status: "", leadStatus: "", minScore: "", search: "" });

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [allMatching, setAllMatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seldIds, setSeldIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFounder = source === "founder";
  const PAGE_SIZE = 100;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // reset paging/select-all when the source or filters change
  function setFounder(patch: Partial<typeof ff>) { setFf({ ...ff, ...patch }); setPage(0); setAllMatching(false); setSeldIds(new Set()); }
  function setPipe(patch: Partial<typeof pf>) { setPf({ ...pf, ...patch }); setPage(0); setAllMatching(false); setSeldIds(new Set()); }
  function pickSource(s: Source) { setSource(s); setPage(0); setAllMatching(false); setSeldIds(new Set()); }

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url: string;
      if (isFounder) {
        const p = new URLSearchParams();
        if (ff.stage) p.set("stage", ff.stage);
        if (ff.sector) p.set("sector", ff.sector);
        if (ff.jurisdiction) p.set("jurisdiction", ff.jurisdiction);
        if (ff.minReadiness) p.set("minReadiness", ff.minReadiness);
        if (ff.minFunding) p.set("minFunding", ff.minFunding);
        if (ff.search) p.set("search", ff.search);
        url = `/api/prospects/founders?${p.toString()}`;
      } else {
        const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
        if (source !== "all") p.set("source", source);
        if (pf.side) p.set("side", pf.side);
        if (pf.segment) p.set("segment", pf.segment);
        if (pf.status) p.set("status", pf.status);
        if (pf.leadStatus) p.set("leadStatus", pf.leadStatus);
        if (pf.search) p.set("search", pf.search);
        url = `/api/prospects/list?${p.toString()}`;
      }
      const res = await fetch(url);
      const data = res.ok ? await res.json() : { rows: [], total: 0 };
      const rws = (data.rows ?? []) as Row[];
      setRows(rws);
      setTotal(data.total ?? rws.length);
      // NB: selection is NOT reset here — ticks persist across pages. Filter/source
      // changes clear it (setFounder/setPipe/pickSource).
    } catch {
      setRows([]); setTotal(0);
    }
    setLoading(false);
  }, [isFounder, source, ff, pf, page]);

  useEffect(() => {
    if (step < 1) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void fetchRows(); }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [step, fetchRows]);

  function toggle(id: string) {
    setSeldIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function filterBody() {
    if (isFounder) {
      return {
        stage: ff.stage || undefined, sector: ff.sector || undefined, jurisdiction: ff.jurisdiction || undefined,
        minReadiness: ff.minReadiness ? Number(ff.minReadiness) : undefined,
        minFunding: ff.minFunding ? Number(ff.minFunding) : undefined, search: ff.search || undefined,
      };
    }
    return {
      source: source !== "all" ? source : undefined,
      side: pf.side || undefined,
      segment: pf.segment || undefined, status: pf.status || undefined, leadStatus: pf.leadStatus || undefined,
      minScore: pf.minScore ? Number(pf.minScore) : undefined, search: pf.search || undefined,
    };
  }

  async function save(mode: "selected" | "all") {
    if (!name.trim()) return;
    setSaving(true); setError(null); setMsg(null);
    try {
      const endpoint = isFounder ? "/api/prospects/founders/save-list" : "/api/prospects/save-list";
      const body: Record<string, unknown> = { filters: filterBody(), name: name.trim() };
      // "all matching" (or explicit all) saves by filters; otherwise by the ticked ids
      if (mode === "selected" && !allMatching) body.contactIds = [...seldIds];
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setMsg(`Created “${data.listName}” with ${data.added.toLocaleString()} contacts.`);
      setName("");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(false); }
  }

  const chips = SUB_STEPS.map((t, i) => {
    const done = i < step, active = i === step;
    return (
      <span key={t} style={{ fontSize: 10.5, fontWeight: active ? 800 : done ? 700 : 600, color: done ? "#0F6E56" : active ? "#1A6CE4" : "var(--muted-foreground)" }}>
        {done ? "✓ " : ""}{i + 1} {t}
      </span>
    );
  });

  const nextLabel = step < SUB_STEPS.length - 1 ? `Next: ${SUB_STEPS[step + 1]} →` : null;
  const canNext = step === 0 ? true : step === 1 ? total > 0 : true;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {chips.map((c, i) => <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>{c}{i < chips.length - 1 ? <span style={{ color: "var(--border-strong,#cbd5e1)" }}>·</span> : null}</span>)}
      </div>

      {/* STEP 0 — Source */}
      {step === 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>Where should this list come from?</p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {SOURCES.map((s) => (
              <button key={s.id} onClick={() => pickSource(s.id)}
                style={{ fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "9px 14px", cursor: "pointer",
                  border: source === s.id ? "1px solid #2E78F5" : "0.5px solid var(--border)",
                  background: source === s.id ? "#2E78F5" : "#fff", color: source === s.id ? "#fff" : "var(--muted-foreground)" }}>
                {s.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
            {isFounder ? "Founder profiles pulls platform founders with their stage, sector, readiness, jurisdiction and raise." : "Pipeline sources filter your deduped contact store by segment, lead status and email status."}
          </p>
        </div>
      )}

      {/* STEP 1 — Filter */}
      {step === 1 && (
        <div>
          {isFounder ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <div><label style={label}>Journey stage</label><select value={ff.stage} onChange={(e) => setFounder({ stage: e.target.value })} style={sel}><option value="">Any</option>{STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></div>
              <div><label style={label}>Sector</label><select value={ff.sector} onChange={(e) => setFounder({ sector: e.target.value })} style={sel}><option value="">Any</option>{EVENT_SECTORS.map((s) => <option key={s.slug} value={s.label}>{s.label}</option>)}</select></div>
              <div><label style={label}>Readiness ≥</label><select value={ff.minReadiness} onChange={(e) => setFounder({ minReadiness: e.target.value })} style={sel}><option value="">Any</option><option value="50">50</option><option value="60">60</option><option value="70">70</option><option value="80">80</option></select></div>
              <div><label style={label}>Jurisdiction</label><input value={ff.jurisdiction} onChange={(e) => setFounder({ jurisdiction: e.target.value })} placeholder="e.g. Delaware" style={sel} /></div>
              <div><label style={label}>Raise ≥ ($)</label><input value={ff.minFunding} onChange={(e) => setFounder({ minFunding: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Any" style={sel} /></div>
              <div><label style={label}>Search</label><input value={ff.search} onChange={(e) => setFounder({ search: e.target.value })} placeholder="name, email" style={sel} /></div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <div><label style={{ ...label, color: "#1A6CE4" }}>Side</label><select value={pf.side} onChange={(e) => setPipe({ side: e.target.value })} style={{ ...sel, borderColor: pf.side ? "#2E78F5" : "var(--border)" }}><option value="">Any</option><option value="founder">Founders</option><option value="investor">Investors</option></select></div>
              <div><label style={label}>Segment</label><select value={pf.segment} onChange={(e) => setPipe({ segment: e.target.value })} style={sel}><option value="">Any</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></div>
              <div><label style={{ ...label, color: "#1A6CE4" }}>Lead status</label><select value={pf.leadStatus} onChange={(e) => setPipe({ leadStatus: e.target.value })} style={sel}><option value="">Any</option>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></div>
              <div><label style={label}>Email status</label><select value={pf.status} onChange={(e) => setPipe({ status: e.target.value })} style={sel}><option value="">Any</option><option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option><option value="unverified">Unverified</option></select></div>
              <div><label style={label}>Pre-score ≥</label><select value={pf.minScore} onChange={(e) => setPipe({ minScore: e.target.value })} style={sel}><option value="">Any</option><option value="40">40</option><option value="55">55</option><option value="65">65</option><option value="80">80</option></select></div>
              <div><label style={label}>Search</label><input value={pf.search} onChange={(e) => setPipe({ search: e.target.value })} placeholder="name, email, company" style={sel} /></div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#1A6CE4" }}>{loading ? "…" : total.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{isFounder ? "founders match" : "match"}{isFounder && " · live from your DB"}</span>
          </div>
        </div>
      )}

      {/* STEP 2 — Select */}
      {step === 2 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1A4E9E" }}>
              {allMatching ? `All ${total.toLocaleString()} matching selected` : `${seldIds.size.toLocaleString()} of ${total.toLocaleString()} selected`}
            </span>
            {total > rows.length ? (
              <button onClick={() => setAllMatching(true)} style={{ fontSize: 10.5, fontWeight: 700, color: allMatching ? "#065F46" : "#fff", background: allMatching ? "#ECFDF5" : "#0F6E56", border: allMatching ? "0.5px solid #A7F3D0" : "none", borderRadius: 999, padding: "3px 10px", cursor: "pointer" }}>
                {allMatching ? `✓ All ${total.toLocaleString()}` : `Select all ${total.toLocaleString()}`}
              </button>
            ) : null}
            {!allMatching && <button onClick={() => setSeldIds((prev) => new Set([...prev, ...rows.map((r) => r.id)]))} style={{ fontSize: 10.5, color: "#1A6CE4", background: "none", border: "none", cursor: "pointer" }}>Select page</button>}
            <button onClick={() => { setAllMatching(false); setSeldIds(new Set()); }} style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Unselect all</button>
          </div>
          <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
            {loading ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>Loading…</p>
            : rows.length === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No matches.</p> : rows.map((r) => {
              const checked = allMatching || seldIds.has(r.id);
              return (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "26px 1.5fr 1.3fr auto", gap: 8, padding: "8px 11px", borderBottom: "0.5px solid var(--border)", alignItems: "center", fontSize: 11.5, background: checked ? "#F5F9FF" : undefined }}>
                  <input type="checkbox" checked={checked} disabled={allMatching} onChange={() => toggle(r.id)} style={{ accentColor: "#2E78F5" }} />
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || r.email}</div><div style={{ fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div></div>
                  <div style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.company ?? "—"}</div>
                  <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--muted-foreground)" }}>{isFounder ? (r.readiness != null ? `${r.readiness}/100` : cap(r.journey_stage ?? "")) : cap(r.segment ?? r.email_status ?? "")}</div>
                </div>
              );
            })}
          </div>
          {!isFounder && total > PAGE_SIZE ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{ fontSize: 11, border: "0.5px solid var(--border)", background: "#fff", borderRadius: 6, padding: "6px 11px", color: "var(--muted-foreground)", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.5 : 1 }}>‹ Prev</button>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Page <b style={{ color: "var(--foreground)" }}>{page + 1}</b> of {pageCount.toLocaleString()} · {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}</span>
              <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page + 1 >= pageCount} style={{ fontSize: 11, fontWeight: 700, border: "0.5px solid #93C5FD", background: "#EFF6FF", color: "#1A6CE4", borderRadius: 6, padding: "6px 11px", cursor: page + 1 >= pageCount ? "default" : "pointer", opacity: page + 1 >= pageCount ? 0.5 : 1 }}>Next page ›</button>
            </div>
          ) : null}
        </div>
      )}

      {/* STEP 3 — Save */}
      {step === 3 && (
        <div>
          {done ? (
            <div style={{ background: "#ECFDF5", border: "0.5px solid #A7F3D0", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>{msg}</div><div style={{ fontSize: 11.5, color: "#047857" }}>It&rsquo;s saved to your Contact Lists. Next: verify emails and fill missing details.</div></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => router.push("/admin/marketing/prospects?step=verify")} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}>Verify &amp; Correct →</button>
                <button onClick={() => router.push("/admin/marketing/prospects?step=list")} style={{ fontSize: 12, fontWeight: 700, color: "#0F6E56", background: "#fff", border: "0.5px solid #A7F3D0", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}>Go to Contact Lists</button>
              </div>
            </div>
          ) : (
            <>
              <label style={label}>Name this list</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFounder ? "e.g. Qualified FinTech founders" : "e.g. Odoo investors · valid"} style={{ ...sel, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {allMatching ? (
                  <button onClick={() => save("all")} disabled={saving || !name.trim() || total === 0}
                    style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 15px", cursor: "pointer", opacity: saving || !name.trim() || total === 0 ? 0.5 : 1 }}>
                    {saving ? "Creating…" : `Create from all ${total.toLocaleString()} matching`}
                  </button>
                ) : (
                  <>
                    <button onClick={() => save("selected")} disabled={saving || !name.trim() || seldIds.size === 0}
                      style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 15px", cursor: "pointer", opacity: saving || !name.trim() || seldIds.size === 0 ? 0.5 : 1 }}>
                      {saving ? "Creating…" : `Create from ${seldIds.size} selected`}
                    </button>
                    <button onClick={() => save("all")} disabled={saving || !name.trim() || total === 0}
                      style={{ fontSize: 12, fontWeight: 700, color: "#1A6CE4", background: "#fff", border: "0.5px solid #93C5FD", borderRadius: 8, padding: "9px 15px", cursor: "pointer", opacity: saving || !name.trim() || total === 0 ? 0.5 : 1 }}>
                      Create from all {total.toLocaleString()} matching
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {error ? <p style={{ marginTop: 12, background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#991B1B", fontSize: 12, borderRadius: 8, padding: "8px 12px" }}>{error}</p> : null}

      {/* single nav button */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
        {step > 0 ? <button onClick={() => { setStep(step - 1); setMsg(null); }} style={{ fontSize: 11, color: "var(--muted-foreground)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>‹ Back</button> : null}
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>sub-step {step + 1} of {SUB_STEPS.length}</span>
        {nextLabel ? (
          <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext}
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", opacity: canNext ? 1 : 0.5 }}>
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
