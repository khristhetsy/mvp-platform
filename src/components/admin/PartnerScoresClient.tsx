"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Investor = { id: string; name: string; firm: string | null; source: string; isMember: boolean; tier: string | null; score: number | null; engaged: number };
type Counts = { all: number; members: number; prospects: number };
type Weights = { followThrough: number; responsiveness: number; credibility: number; portfolioReadiness: number; trackRecord: number };

const PILLARS: Array<{ key: keyof Weights; label: string }> = [
  { key: "followThrough", label: "Follow-through" },
  { key: "responsiveness", label: "Responsiveness" },
  { key: "credibility", label: "Credibility" },
  { key: "portfolioReadiness", label: "Portfolio readiness" },
  { key: "trackRecord", label: "Track record" },
];
const SOURCES = ["Member", "SEC Form D", "Imported"];
const PER_PAGE = 100;

export function PartnerScoresClient({ initialWeights }: Readonly<{ initialWeights: Weights }>) {
  const [tab, setTab] = useState<"investors" | "weights">("investors");
  return (
    <div>
      <div className="mb-4 flex gap-6 border-b border-slate-200">
        {(["investors", "weights"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium ${tab === t ? "border-indigo-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t === "investors" ? "Investors" : "Scoring weights"}
          </button>
        ))}
      </div>
      {tab === "investors" ? <InvestorsTab /> : <WeightsTab initial={initialWeights} />}
    </div>
  );
}

function InvestorsTab() {
  const [rows, setRows] = useState<Investor[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, members: 0, prospects: 0 });
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<"all" | "members" | "prospects">("all");
  const [sourceSel, setSourceSel] = useState<string[]>([]);
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      const srcs = seg === "members" ? ["Member"] : seg === "prospects" ? SOURCES.filter((s) => s !== "Member") : sourceSel;
      if (srcs.length) p.set("source", srcs.join(","));
      if (minScore) p.set("minScore", minScore);
      p.set("sort", sort);
      p.set("limit", String(PER_PAGE));
      p.set("offset", String(page * PER_PAGE));
      const res = await fetch(`/api/admin/partner-scores/investors?${p}`);
      const j = await res.json().catch(() => ({}));
      setRows(j.investors ?? []);
      setTotal(j.total ?? 0);
      if (j.counts) setCounts(j.counts);
    } finally {
      setLoading(false);
    }
  }, [q, seg, sourceSel, minScore, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const seg_ = (key: typeof seg, label: string, n: number) => (
    <button type="button" onClick={() => { setSeg(key); setPage(0); }} className={`rounded-md px-2.5 py-1 text-xs font-medium ${seg === key ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-500 hover:text-slate-700"}`}>
      {label} · {n.toLocaleString()}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search investor, firm…" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <div className="relative">
          <button type="button" onClick={() => setShowFilters((v) => !v)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${sourceSel.length || minScore ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600"}`}>Filters{sourceSel.length || minScore ? ` · ${sourceSel.length + (minScore ? 1 : 0)}` : ""}</button>
          {showFilters ? (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Source</div>
              {SOURCES.map((s) => (
                <label key={s} className="flex items-center gap-2 py-1 text-xs text-slate-700">
                  <input type="checkbox" checked={sourceSel.includes(s)} onChange={() => { setSourceSel((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]); setPage(0); }} className="h-3.5 w-3.5" />
                  {s}
                </label>
              ))}
              <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Min score</div>
              <input value={minScore} onChange={(e) => { setMinScore(e.target.value.replace(/[^\d]/g, "")); setPage(0); }} placeholder="0" className="mt-1 w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-xs" />
            </div>
          ) : null}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs">
          <option value="score">Sort: Score</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {seg_("all", "All", counts.all)}
        {seg_("members", "Members", counts.members)}
        {seg_("prospects", "Prospects", counts.prospects)}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
              <th className="px-3 py-2.5">INVESTOR</th>
              <th className="w-28 px-3 py-2.5">SOURCE</th>
              <th className="w-24 px-3 py-2.5">TIER</th>
              <th className="w-20 px-3 py-2.5">ENGAGED</th>
              <th className="w-16 px-3 py-2.5">SCORE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-slate-500">Loading investors…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-slate-500">No investors match.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="min-w-0 px-3 py-2.5">
                    <p className="truncate font-medium text-slate-900">{r.name}</p>
                    {r.firm ? <p className="truncate text-[11px] text-slate-400">{r.firm}</p> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={r.isMember ? { background: "var(--bg-accent)", color: "var(--text-accent)" } : { background: "var(--surface-1)", color: "var(--text-secondary)" }}>{r.source}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{r.tier ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.engaged || "—"}</td>
                  <td className="px-3 py-2.5">{r.score != null ? <span className="font-semibold text-slate-900">{Math.round(r.score)}</span> : <span className="text-slate-400">New</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Showing {(page * PER_PAGE + 1).toLocaleString()}–{Math.min(total, (page + 1) * PER_PAGE).toLocaleString()} of {total.toLocaleString()}</span>
          <span className="flex-1" />
          <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Back</button>
          <span className="px-2">Page {page + 1} of {totalPages.toLocaleString()}</span>
          <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}

function WeightsTab({ initial }: Readonly<{ initial: Weights }>) {
  const [w, setW] = useState<Weights>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const total = useMemo(() => PILLARS.reduce((a, p) => a + (w[p.key] || 0), 0), [w]);
  const totalPct = Math.round(total * 100);

  async function save() {
    if (totalPct !== 100) { setMsg("Weights must total 100%."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/partner-scores/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: w }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Saved. Recomputed ${j.recomputed ?? 0} investor scores.` : j.error ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4">
        {PILLARS.map((p) => (
          <div key={p.key} className="flex items-center gap-3">
            <span className="w-40 text-sm text-slate-700">{p.label}</span>
            <input type="range" min={0} max={100} step={5} value={Math.round((w[p.key] || 0) * 100)} onChange={(e) => setW((cur) => ({ ...cur, [p.key]: Number(e.target.value) / 100 }))} className="flex-1" />
            <span className="w-12 text-right text-sm font-medium text-slate-900">{Math.round((w[p.key] || 0) * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className={`text-xs font-medium ${totalPct === 100 ? "text-emerald-600" : "text-rose-600"}`}>Total {totalPct}%{totalPct === 100 ? "" : " — must equal 100%"}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setW(initial)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Reset</button>
          <button type="button" disabled={busy || totalPct !== 100} onClick={save} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Recomputing…" : "Save and recompute"}</button>
        </div>
      </div>
      {msg ? <p className="mt-3 text-xs font-medium text-indigo-700">{msg}</p> : null}
    </div>
  );
}
