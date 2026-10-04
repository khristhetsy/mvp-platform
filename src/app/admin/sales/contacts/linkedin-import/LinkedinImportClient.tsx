"use client";

/**
 * Import LinkedIn connections: 1 Upload → 2 Match → 3 Import → 4 Enrich.
 * Matching and importing run in chunks so a 20,000-row export stays within request limits.
 * Enrichment runs 50 companies per batch; "Run all" keeps going batch after batch, pausing
 * once after the first batch so the websites can be checked.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { OdooPager } from "@/components/admin/OdooPager";
import { downloadCsv } from "@/components/admin/ToolbarGear";
import { decideMatch, parseConnectionsCsv, type LinkedinConnection, type MatchCandidate, type MatchKind } from "@/lib/contacts/linkedin-import";

type Step = "upload" | "match" | "import" | "enrich";
type Action = "new" | "merge" | "skip";
type Row = LinkedinConnection & { kind: MatchKind; candidates: MatchCandidate[]; action: Action; targetId: string | null };
type Filter = "all" | MatchKind;
type Group = "investor" | "founder" | "other" | "all";
type Budget = { monthlyUsd: number; spentUsd: number } | null;
type Stats = { contacts: number; companies: number; pendingContacts: number; pendingCompanies: number; budget: Budget };
type EnrichRow = { contactId: string; name: string | null; company: string | null; website: string | null; phone: string | null; email: string | null; companyEmail: string | null; result: string; note?: string };
type Batch = { companies: number; rows: EnrichRow[]; budgetReached: boolean; outOfTime: boolean; costUsd: number; budget: Budget; error?: string };

const BLUE = "#2E78F5";
const PAGE = 50;
const STEPS: Array<{ key: Step; label: string }> = [
  { key: "upload", label: "1 Upload" }, { key: "match", label: "2 Match" }, { key: "import", label: "3 Import" }, { key: "enrich", label: "4 Enrich" },
];
const KIND_LABEL: Record<MatchKind, string> = { linkedin: "Same LinkedIn URL", email: "Same email", name: "Same name", new: "New" };
const GROUP_LABEL: Record<Group, string> = { investor: "Investors", founder: "Founders and CEOs", other: "Everyone else", all: "All LinkedIn contacts" };
const RESULT_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  enriched: { text: "Enriched", bg: "#EAF3DE", fg: "#27500A" },
  website_only: { text: "Website only", bg: "#E6F1FB", fg: "#0C447C" },
  no_website: { text: "No website found", bg: "#F1EFE8", fg: "#444441" },
  no_company: { text: "No company", bg: "#F1EFE8", fg: "#444441" },
  merged: { text: "Merged into existing", bg: "#FAEEDA", fg: "#633806" },
  phone_elsewhere: { text: "Phone on another contact", bg: "#FAEEDA", fg: "#633806" },
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
  if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status}).`);
  return d as T;
}
const n = (v: number) => v.toLocaleString("en-US");
const usd = (v: number) => `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;

function Tile({ label, value, sub, on, onClick }: { label: string; value: string; sub?: string; on?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      style={{ textAlign: "left", background: "var(--muted)", border: on ? `1.5px solid ${BLUE}` : "1.5px solid transparent", borderRadius: 8, padding: "9px 11px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: "var(--foreground)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sub}</div>}
    </button>
  );
}

function Btn({ children, primary, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...p} style={{ fontSize: 12.5, fontWeight: primary ? 600 : 400, color: primary ? "#fff" : "var(--foreground)", background: primary ? BLUE : "#fff", border: primary ? "none" : "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 14px", cursor: p.disabled ? "default" : "pointer", opacity: p.disabled ? 0.55 : 1, ...p.style }}>{children}</button>;
}

const th: React.CSSProperties = { textAlign: "left", fontWeight: 500, fontSize: 11.5, color: "var(--muted-foreground)", padding: "7px 8px", borderBottom: "0.5px solid #e3e8f0" };
const td: React.CSSProperties = { fontSize: 12.5, padding: "7px 8px", borderBottom: "0.5px solid #eef1f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function LinkedinImportClient({ initialStep }: { initialStep: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [skippedInFile, setSkippedInFile] = useState({ hidden: 0, repeated: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [imported, setImported] = useState<{ created: number; merged: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1 + 2: parse, then match in chunks ──
  async function onFile(f: File | null) {
    if (!f) return;
    setErr(null); setImported(null); setRows([]); setFilter("all"); setPage(0);
    let parsed;
    try { parsed = parseConnectionsCsv(await f.text()); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read the file."); return; }
    if (parsed.rows.length === 0) { setErr("No connections with a LinkedIn profile in this file."); return; }
    setFileName(f.name); setSkippedInFile({ hidden: parsed.hidden, repeated: parsed.repeated });
    setBusy(true);
    try {
      const cands = new Map<number, MatchCandidate[]>();
      const CH = 1000;
      for (let k = 0; k < parsed.rows.length; k += CH) {
        setProgress(`Checking ${n(Math.min(k + CH, parsed.rows.length))} of ${n(parsed.rows.length)} against Contacts…`);
        const part = parsed.rows.slice(k, k + CH).map((r, j) => ({ i: k + j, slug: r.slug, email: r.email, name: r.name }));
        const d = await postJson<{ matches: Array<{ idx: number; kind: "linkedin" | "email" | "name"; contact_id: string; contact_name: string | null; contact_company: string | null }> }>("/api/sales/contacts/linkedin-import", { mode: "match", rows: part });
        for (const m of d.matches) cands.set(m.idx, [...(cands.get(m.idx) ?? []), { kind: m.kind, id: m.contact_id, name: m.contact_name, company: m.contact_company }]);
      }
      setRows(parsed.rows.map((r, i) => {
        const dm = decideMatch(cands.get(i) ?? []);
        const action: Action = dm.kind === "new" ? "new" : dm.defaultTarget ? "merge" : "skip";
        return { ...r, kind: dm.kind, candidates: dm.candidates, action, targetId: dm.defaultTarget };
      }));
      setStep("match");
    } catch (e) { setErr(e instanceof Error ? e.message : "Matching failed."); }
    finally { setBusy(false); setProgress(null); }
  }

  const counts = useMemo(() => {
    const c = { linkedin: 0, email: 0, name: 0, new: 0, newWithEmail: 0, create: 0, merge: 0, skip: 0 };
    for (const r of rows) {
      c[r.kind]++;
      if (r.kind === "new" && r.email) c.newWithEmail++;
      if (r.action === "new") c.create++; else if (r.action === "merge") c.merge++; else c.skip++;
    }
    return c;
  }, [rows]);
  const shown = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.kind === filter)), [rows, filter]);
  const pageRows = shown.slice(page * PAGE, page * PAGE + PAGE);

  function setAction(slug: string, value: string) {
    setRows((rs) => rs.map((r) => {
      if (r.slug !== slug) return r;
      if (value === "new" || value === "skip") return { ...r, action: value, targetId: r.kind === "name" ? r.targetId : r.targetId };
      return { ...r, action: "merge", targetId: value };
    }));
  }

  function nameRule(rule: string) {
    setRows((rs) => rs.map((r) => {
      if (r.kind !== "name") return r;
      if (rule === "single") return r.candidates.length === 1 ? { ...r, action: "merge", targetId: r.candidates[0].id } : { ...r, action: "skip", targetId: null };
      if (rule === "company") {
        const co = (r.company ?? "").toLowerCase().trim();
        const hit = co ? r.candidates.filter((c) => (c.company ?? "").toLowerCase().trim() === co) : [];
        return hit.length === 1 ? { ...r, action: "merge", targetId: hit[0].id } : { ...r, action: "skip", targetId: null };
      }
      if (rule === "skip") return { ...r, action: "skip", targetId: null };
      return { ...r, action: "new", targetId: null };
    }));
  }

  // ── Step 3: import in chunks ──
  async function runImport() {
    setBusy(true); setErr(null);
    const tot = { created: 0, merged: 0, skipped: 0 };
    try {
      const todo = rows.filter((r) => r.action !== "skip");
      tot.skipped = rows.length - todo.length;
      const CH = 500;
      for (let k = 0; k < todo.length; k += CH) {
        setProgress(`Importing ${n(Math.min(k + CH, todo.length))} of ${n(todo.length)}…`);
        const part = todo.slice(k, k + CH).map((r) => ({
          slug: r.slug, url: r.url, firstName: r.firstName, lastName: r.lastName, name: r.name, email: r.email, company: r.company,
          position: r.position, connectedOn: r.connectedOn, group: r.group, action: r.action, targetId: r.action === "merge" ? r.targetId : null,
        }));
        const d = await postJson<{ created: number; merged: number; skipped: number }>("/api/sales/contacts/linkedin-import", { mode: "commit", fileName, rows: part });
        tot.created += d.created; tot.merged += d.merged; tot.skipped += d.skipped;
        setImported({ ...tot });
      }
      setImported({ ...tot });
    } catch (e) { setErr(e instanceof Error ? `${e.message} Contacts imported so far are kept; run the import again to finish (nothing is added twice).` : "Import failed."); }
    finally { setBusy(false); setProgress(null); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 12px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Import LinkedIn connections</h1>
        {fileName && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{fileName}</span>}
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {STEPS.map((s) => {
            const idx = STEPS.findIndex((x) => x.key === step), me = STEPS.findIndex((x) => x.key === s.key);
            const canGo = s.key === "upload" || s.key === "enrich" || (rows.length > 0 && s.key !== "import") || (s.key === "import" && rows.length > 0);
            return (
              <button key={s.key} type="button" disabled={busy || !canGo} onClick={() => setStep(s.key)}
                style={{ fontSize: 12, padding: "5px 11px", borderRadius: 8, cursor: busy || !canGo ? "default" : "pointer",
                  border: `0.5px solid ${s.key === step ? "#85B7EB" : me < idx ? "#97C459" : "#cdd9ec"}`,
                  background: s.key === step ? "#E6F1FB" : "#fff", color: s.key === step ? "#0C447C" : me < idx ? "#27500A" : "var(--muted-foreground)" }}>
                {me < idx && <i className="ti ti-check" aria-hidden="true" style={{ marginRight: 4 }} />}{s.label}
              </button>
            );
          })}
        </div>
      </div>

      {err && <div role="alert" style={{ fontSize: 12.5, color: "#A32D2D", background: "#FCEBEB", borderRadius: 8, padding: "8px 11px", marginBottom: 10 }}>{err}</div>}
      {progress && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 10 }}><i className="ti ti-loader-2" aria-hidden="true" /> {progress}</div>}

      {step === "upload" && (
        <div style={{ border: "1px dashed #b9c8de", borderRadius: 12, padding: 28, textAlign: "center", background: "#fff" }}>
          <i className="ti ti-brand-linkedin" style={{ fontSize: 28, color: "#0A66C2" }} aria-hidden="true" />
          <p style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>Upload Connections.csv from your LinkedIn data export</p>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 14px" }}>Each connection is checked against Contacts by LinkedIn profile, email and name before anything is added. Existing contacts only get blank fields filled.</p>
          <Btn primary disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Checking…" : "Choose file"}</Btn>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { void onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "14px 0 0" }}>Already imported? <button type="button" onClick={() => setStep("enrich")} style={{ background: "none", border: "none", color: BLUE, cursor: "pointer", padding: 0, fontSize: 12 }}>Go to enrichment</button></p>
        </div>
      )}

      {step === "match" && rows.length > 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
            <Tile label="Connections" value={n(rows.length)} sub={`${n(skippedInFile.hidden)} hidden rows skipped`} on={filter === "all"} onClick={() => { setFilter("all"); setPage(0); }} />
            <Tile label={KIND_LABEL.linkedin} value={n(counts.linkedin)} sub="Existing, fill blanks" on={filter === "linkedin"} onClick={() => { setFilter("linkedin"); setPage(0); }} />
            <Tile label={KIND_LABEL.email} value={n(counts.email)} sub="Existing, fill blanks" on={filter === "email"} onClick={() => { setFilter("email"); setPage(0); }} />
            <Tile label={KIND_LABEL.name} value={n(counts.name)} sub="Review before merge" on={filter === "name"} onClick={() => { setFilter("name"); setPage(0); }} />
            <Tile label="New contacts" value={n(counts.new)} sub={`${n(counts.newWithEmail)} with email`} on={filter === "new"} onClick={() => { setFilter("new"); setPage(0); }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Same name rows</span>
            <select defaultValue="single" onChange={(e) => nameRule(e.target.value)} style={{ fontSize: 12, height: 30, borderRadius: 8, border: "0.5px solid #cdd9ec", padding: "0 8px" }}>
              <option value="single">Merge when only one contact has the name, else skip</option>
              <option value="company">Merge only when the company also matches, else skip</option>
              <option value="skip">Skip all</option>
              <option value="new">Create all as new contacts</option>
            </select>
            <span style={{ flex: 1 }} />
            <OdooPager label={shown.length ? `${n(page * PAGE + 1)}–${n(Math.min(shown.length, (page + 1) * PAGE))} / ${n(shown.length)}` : "0 / 0"}
              prev={{ onClick: () => setPage((p) => Math.max(0, p - 1)), disabled: page === 0 }}
              next={{ onClick: () => setPage((p) => p + 1), disabled: (page + 1) * PAGE >= shown.length }} />
          </div>

          <div style={{ border: "0.5px solid #e3e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup><col style={{ width: "20%" }} /><col style={{ width: "27%" }} /><col style={{ width: "16%" }} /><col style={{ width: "37%" }} /></colgroup>
              <thead><tr><th style={th}>Name</th><th style={th}>Company, position</th><th style={th}>Match</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.slug}>
                    <td style={td}><a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--foreground)" }}>{r.name}</a></td>
                    <td style={td} title={[r.company, r.position].filter(Boolean).join(", ")}>{[r.company, r.position].filter(Boolean).join(", ") || "—"}</td>
                    <td style={td}>{KIND_LABEL[r.kind]}{r.kind === "name" && r.candidates.length > 1 ? `, ${r.candidates.length} contacts` : ""}</td>
                    <td style={{ ...td, overflow: "visible" }}>
                      <select value={r.action === "merge" ? r.targetId ?? "skip" : r.action} onChange={(e) => setAction(r.slug, e.target.value)}
                        style={{ fontSize: 12, height: 28, maxWidth: "100%", borderRadius: 7, border: "0.5px solid #cdd9ec", padding: "0 6px" }}>
                        {r.candidates.map((c) => <option key={c.id} value={c.id}>{r.kind === "name" ? "Merge into" : "Update"} {c.name ?? "contact"}{c.company ? `, ${c.company}` : ""}</option>)}
                        <option value="new">Create new contact</option>
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginRight: "auto" }}>{n(counts.create)} to create · {n(counts.merge)} to update · {n(counts.skip)} skipped</span>
            <Btn onClick={() => setStep("upload")}>Back</Btn>
            <Btn primary onClick={() => setStep("import")}>Continue to import</Btn>
          </div>
        </div>
      )}

      {step === "import" && rows.length > 0 && (
        <div style={{ border: "0.5px solid #e3e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <Tile label={imported ? "Created" : "To create"} value={n(imported ? imported.created : counts.create)} sub="Source LinkedIn, tagged LinkedIn" />
            <Tile label={imported ? "Updated" : "To update"} value={n(imported ? imported.merged : counts.merge)} sub="Blank fields only" />
            <Tile label="Skipped" value={n(imported ? imported.skipped : counts.skip)} />
          </div>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "10px 0 0" }}>New contacts get name, company, position, LinkedIn URL and any email LinkedIn shared. Running the import again never adds the same profile twice.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            {!imported || busy ? (
              <>
                <Btn disabled={busy} onClick={() => setStep("match")}>Back</Btn>
                <Btn primary disabled={busy || counts.create + counts.merge === 0} onClick={() => void runImport()}>{busy ? "Importing…" : `Import ${n(counts.create + counts.merge)} connections`}</Btn>
              </>
            ) : (
              <>
                <Link href="/admin/sales/contacts" style={{ fontSize: 12.5, padding: "7px 14px", border: "0.5px solid #cdd9ec", borderRadius: 8, color: "var(--foreground)", textDecoration: "none" }}>Open Contacts</Link>
                <Btn primary onClick={() => setStep("enrich")}>Continue to enrich</Btn>
              </>
            )}
          </div>
        </div>
      )}

      {step === "enrich" && <EnrichPanel />}
    </div>
  );
}

function EnrichPanel() {
  const [group, setGroup] = useState<Group>("investor");
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<EnrichRow[]>([]);
  const [state, setState] = useState<"idle" | "running" | "checkpoint" | "paused" | "done">("idle");
  const [batches, setBatches] = useState(0);
  const [cost, setCost] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const stop = useRef(false);

  async function loadStats(g: Group) {
    try {
      const res = await fetch(`/api/sales/contacts/linkedin-enrich?group=${g}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't load.");
      setStats(d as Stats);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't load."); }
  }
  useEffect(() => {
    let off = false;
    fetch(`/api/sales/contacts/linkedin-enrich?group=${group}`)
      .then(async (res) => ({ ok: res.ok, d: await res.json() }))
      .then(({ ok, d }) => { if (off) return; if (ok) setStats(d as Stats); else setMsg(d.error ?? "Couldn't load."); })
      .catch(() => { if (!off) setMsg("Couldn't load."); });
    return () => { off = true; };
  }, [group]);

  async function run(fromCheckpoint = false) {
    stop.current = false; setMsg(null); setState("running");
    let first = !fromCheckpoint && batches === 0;
    for (;;) {
      let b: Batch;
      try { b = await postJson<Batch>("/api/sales/contacts/linkedin-enrich", { group, limit: 50 }); }
      catch (e) { setMsg(e instanceof Error ? e.message : "Enrichment failed."); setState("paused"); break; }
      setResults((r) => [...b.rows, ...r]);
      setBatches((x) => x + 1);
      setCost((c) => c + b.costUsd);
      setStats((s) => (s ? { ...s, budget: b.budget ?? s.budget } : s));
      await loadStats(group);
      if (b.budgetReached) { setMsg("The Data enrichment budget for this month is used up. The rest stays pending; raise it under Admin › Feature Controls or continue next month."); setState("paused"); break; }
      if (b.companies === 0 && b.rows.length === 0) { setMsg("Every company in this group has been checked."); setState("done"); break; }
      if (first) { setState("checkpoint"); break; }
      if (stop.current) { setState("paused"); break; }
      first = false;
    }
  }

  const t = useMemo(() => {
    const x = { website: 0, phone: 0, email: 0, existing: 0 };
    for (const r of results) {
      if (r.website) x.website++;
      if (r.phone) x.phone++;
      if (r.email || r.companyEmail) x.email++;
      if (r.result === "merged" || r.result === "phone_elsewhere") x.existing++;
    }
    return x;
  }, [results]);
  const pageRows = results.slice(page * PAGE, page * PAGE + PAGE);
  const doneCompanies = stats ? stats.companies - stats.pendingCompanies : 0;
  const running = state === "running";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Group</span>
        <select value={group} disabled={running} onChange={(e) => { setGroup(e.target.value as Group); setResults([]); setBatches(0); setCost(0); setState("idle"); setPage(0); }}
          style={{ fontSize: 12, height: 30, borderRadius: 8, border: "0.5px solid #cdd9ec", padding: "0 8px" }}>
          {(Object.keys(GROUP_LABEL) as Group[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>50 companies per batch</span>
        <span style={{ flex: 1 }} />
        {stats && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{n(doneCompanies)} / {n(stats.companies)} companies done · {n(stats.pendingContacts)} contacts left</span>}
      </div>
      {stats && stats.companies > 0 && (
        <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round((doneCompanies / stats.companies) * 100)}%`, background: BLUE }} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
        <Tile label="Website found" value={n(t.website)} sub={`of ${n(results.length)} contacts checked`} />
        <Tile label="Phone found" value={n(t.phone)} sub="Published on the site" />
        <Tile label="Email found" value={n(t.email)} sub="Personal or company" />
        <Tile label="Already in Contacts" value={n(t.existing)} sub="Merged or not copied" />
        <Tile label="Cost this run" value={usd(cost)} sub={stats?.budget ? `${usd(stats.budget.spentUsd)} of ${usd(stats.budget.monthlyUsd)} this month` : "Data enrichment budget"} />
      </div>

      {state === "checkpoint" && (
        <div style={{ fontSize: 12.5, background: "#E6F1FB", color: "#0C447C", borderRadius: 8, padding: "9px 12px", marginTop: 10 }}>
          First batch done. Check the websites below; if they look right, continue and the rest runs batch after batch.
        </div>
      )}
      {msg && <div style={{ fontSize: 12.5, background: "#FAEEDA", color: "#633806", borderRadius: 8, padding: "9px 12px", marginTop: 10 }}>{msg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{batches ? `${n(batches)} batch${batches === 1 ? "" : "es"} run` : "Phone source: site · Email source: site"}</span>
        <span style={{ flex: 1 }} />
        <OdooPager label={results.length ? `${n(page * PAGE + 1)}–${n(Math.min(results.length, (page + 1) * PAGE))} / ${n(results.length)}` : "0 / 0"}
          prev={{ onClick: () => setPage((p) => Math.max(0, p - 1)), disabled: page === 0 }}
          next={{ onClick: () => setPage((p) => p + 1), disabled: (page + 1) * PAGE >= results.length }} />
      </div>

      <div style={{ border: "0.5px solid #e3e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "18%" }} /><col style={{ width: "15%" }} /><col style={{ width: "19%" }} /><col style={{ width: "16%" }} /></colgroup>
          <thead><tr><th style={th}>Name</th><th style={th}>Company</th><th style={th}>Website</th><th style={th}>Phone</th><th style={th}>Email</th><th style={th}>Result</th></tr></thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)", padding: 18 }}>Run a batch to see results here.</td></tr>}
            {pageRows.map((r) => {
              const rl = RESULT_LABEL[r.result] ?? RESULT_LABEL.no_website;
              return (
                <tr key={r.contactId}>
                  <td style={td}>{r.result === "merged" ? r.name : <Link href={`/admin/sales/contacts/${r.contactId}`} style={{ color: "var(--foreground)" }}>{r.name}</Link>}</td>
                  <td style={td}>{r.company ?? "—"}</td>
                  <td style={td}>{r.website ? <a href={r.website} target="_blank" rel="noreferrer" style={{ color: BLUE }}>{r.website.replace(/^https?:\/\//, "")}</a> : "Not found"}</td>
                  <td style={td}>{r.phone ? <>{r.phone} <span style={{ fontSize: 10.5, color: "#444441", background: "#F1EFE8", borderRadius: 6, padding: "1px 6px" }}>office</span></> : r.website ? "Not published" : "—"}</td>
                  <td style={td} title={r.email ?? r.companyEmail ?? ""}>{r.email ?? (r.companyEmail ? <>{r.companyEmail} <span style={{ fontSize: 10.5, color: "#444441", background: "#F1EFE8", borderRadius: 6, padding: "1px 6px" }}>company</span></> : r.website ? "Not published" : "—")}</td>
                  <td style={td} title={r.note ?? ""}><span style={{ fontSize: 11, background: rl.bg, color: rl.fg, borderRadius: 6, padding: "2px 8px" }}>{rl.text}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginRight: "auto" }}>Stops by itself at the monthly Data enrichment budget.</span>
        <Btn disabled={!results.length} onClick={() => downloadCsv(`linkedin-enrichment-${group}.csv`, ["Name", "Company", "Website", "Phone", "Email", "Company email", "Result", "Note"], results.map((r) => [r.name, r.company, r.website, r.phone, r.email, r.companyEmail, RESULT_LABEL[r.result]?.text ?? r.result, r.note ?? ""]))}>Export results</Btn>
        {running
          ? <Btn onClick={() => { stop.current = true; setMsg("Pausing after this batch…"); }}>Pause</Btn>
          : state === "checkpoint"
            ? <Btn primary onClick={() => void run(true)}>Continue all</Btn>
            : <Btn primary disabled={state === "done" || (stats?.pendingCompanies ?? 0) === 0} onClick={() => void run()}>{batches ? "Resume" : "Run all"}</Btn>}
      </div>
    </div>
  );
}
