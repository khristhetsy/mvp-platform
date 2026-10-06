"use client";

// Learned email formats per company domain (spec 5.2, mockup screen 5).
// A domain counts as learned at 2+ known emails in one format and none in another.

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";

type Row = { domain: string; pattern: string; format_counts: Record<string, number>; verified_samples: number; conflicting_samples: number; catch_all: boolean | null; last_checked_at: string };
type Resp = { rows: Row[]; total: number; learned: number; domains: number; error?: string };

async function fetchPatterns(): Promise<Resp> {
  const r = await fetch("/api/prospects/domain-patterns");
  return (await r.json()) as Resp;
}

const LEARNED_MIN = 2;
const isLearned = (r: Row) => r.verified_samples >= LEARNED_MIN && r.conflicting_samples === 0;
const status = (r: Row) => (isLearned(r) ? "Learned" : r.conflicting_samples > 0 ? "Mixed formats" : "Needs one more email");

const FIELDS: SearchField<Row>[] = [
  { label: "domain", get: (r) => r.domain },
  { label: "format", get: (r) => r.pattern },
  { label: "status", get: (r) => status(r) },
  { label: "samples", get: (r) => r.verified_samples },
];

export function DomainPatterns() {
  const [data, setData] = useState<Resp | null>(null);
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((j: Resp) => {
    setData(j);
    if (j.error) setError(`Formats aren't available yet: ${j.error}`);
  }, []);
  const load = useCallback(async () => apply(await fetchPatterns()), [apply]);
  useEffect(() => {
    let live = true;
    fetchPatterns().then((j) => { if (live) apply(j); }).catch(() => { if (live) setError("Could not load formats."); });
    return () => { live = false; };
  }, [apply]);

  async function learn() {
    setRunning(true); setMsg(null); setError(null);
    try {
      const r = await fetch("/api/prospects/domain-patterns", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Learning failed.");
      setMsg(`Read ${j.scanned.toLocaleString()} contacts with a known email. ${j.matched.toLocaleString()} fit a name format, across ${j.domains.toLocaleString()} domains; ${j.learned.toLocaleString()} domains are now learned.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Learning failed.");
    } finally { setRunning(false); }
  }

  const result = useMemo(() => matchRows(data?.rows ?? [], FIELDS, q), [data, q]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">Company email formats</h3>
          <p className="text-[11.5px] text-slate-500">
            {data ? <>{data.learned.toLocaleString()} learned of {data.domains.toLocaleString()} domains seen. </> : null}
            Learned from emails you already have; guesses never count.
          </p>
        </div>
        <button type="button" onClick={learn} disabled={running}
          className="ml-auto rounded-md bg-[#1A6CE4] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#2E78F5] disabled:opacity-50">
          {running ? "Learning…" : "Learn from existing contacts"}
        </button>
      </header>
      <div className="space-y-2 px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search domain, format, status…"
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs" aria-label="Search formats" />
        {msg ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-900">{msg}</p> : null}
        {error ? <p className="rounded-md bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">{error}</p> : null}
        {data ? <SearchCount result={result} noun="domains" /> : null}
      </div>
      {!data ? (
        <p className="px-4 pb-4 text-xs text-slate-500">Loading…</p>
      ) : result.active && result.rows.length === 0 ? (
        <div className="px-4 pb-4"><NoSearchMatches query={q} fields={FIELDS.map((f) => f.label)} onClear={() => setQ("")} /></div>
      ) : data.rows.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-slate-500">No formats yet. Use &ldquo;Learn from existing contacts&rdquo; to build them from the emails already in the CRM.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2 text-left">Domain</th><th className="px-2 py-2 text-left">Format</th><th className="px-2 py-2 text-right">Samples</th><th className="px-2 py-2 text-right">Other formats</th><th className="px-2 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Updated</th></tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 300).map((r) => (
                <tr key={r.domain} className="border-t border-slate-100">
                  <td className="px-4 py-1.5 font-medium"><Highlight text={r.domain} query={q} /></td>
                  <td className="px-2 py-1.5 font-mono"><Highlight text={r.pattern} query={q} /></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.verified_samples}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.conflicting_samples}</td>
                  <td className="px-2 py-1.5"><span className={isLearned(r) ? "font-semibold text-emerald-700" : "text-amber-700"}><Highlight text={status(r)} query={q} /></span></td>
                  <td className="px-4 py-1.5 text-slate-500">{new Date(r.last_checked_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 300 ? <p className="px-4 py-2 text-[11px] text-slate-500">Showing the first 300; search to narrow.</p> : null}
        </div>
      )}
    </section>
  );
}
