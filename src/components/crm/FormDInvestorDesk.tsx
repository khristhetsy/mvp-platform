"use client";

import { useEffect, useState, useCallback } from "react";

type Firm = {
  id: string;
  display_name: string;
  city: string | null;
  state_or_country: string | null;
  vehicle_count: number;
  regd_footprint: number | null;
  fund_types: string[] | null;
  needs_review: boolean;
  promoted_at: string | null;
  last_investment_at: string | null;
  last_investment_issuer: string | null;
  last_investment_round_size: number | null;
  est_check_size: number | null;
  investments_24mo: number;
  activity_band: "observed" | "single" | "registry";
  formd_rank: number | null;
  ofac: "clear" | "hit" | "review" | "unavailable" | null;
  sec: "clear" | "hit" | "review" | "unavailable" | null;
  iapd: "clear" | "hit" | "review" | "unavailable" | null;
};

type Counts = { observed: number; single: number; registry: number; review: number; total: number };

const fmtUsd = (n: number | null) => (n == null ? "—" : `$${(n / 1_000_000).toFixed(1)}M`);
const daysSince = (d: string | null) => (d ? String(Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : "—");

const BAND: Record<string, [string, string]> = {
  observed: ["var(--bg-success)", "var(--text-success)"],
  single: ["var(--bg-warning)", "var(--text-warning)"],
  registry: ["var(--surface-1)", "var(--text-muted)"],
};

export function FormDInvestorDesk({ canPromote }: Readonly<{ canPromote: boolean }>) {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [counts, setCounts] = useState<Counts>({ observed: 0, single: 0, registry: 0, review: 0, total: 0 });
  const [q, setQ] = useState("");
  const [band, setBand] = useState("");
  const [minRank, setMinRank] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (band) p.set("band", band);
      if (minRank) p.set("minRank", minRank);
      const res = await fetch(`/api/admin/crm/connectors/formd/firms?${p}`);
      const json = await res.json().catch(() => ({}));
      setFirms(json.firms ?? []);
      if (json.counts) setCounts(json.counts);
    } finally {
      setLoading(false);
    }
  }, [q, band, minRank]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function promote(f: Firm) {
    const basis = window.prompt(`Promote "${f.display_name}" into the investor list.\nGDPR lawful basis (recorded per record):`, "legitimate_interest");
    if (!basis) return;
    setBusyId(f.id);
    setNote(null);
    try {
      const res = await fetch("/api/admin/crm/connectors/formd/promote-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId: f.id, lawfulBasis: basis }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setNote(res.status === 409 ? `Blocked: ${j.error}` : j.error ?? "Promote failed.");
      else if (j.action === "review") setNote(`${f.display_name}: a similar investor exists — held for review.`);
      else { setNote(`${f.display_name}: ${j.action === "matched" ? "matched an existing investor" : "added to the investor list"}.`); load(); }
    } finally {
      setBusyId(null);
    }
  }

  const chip = (key: string, label: string, n: number, color?: string) => (
    <button
      type="button"
      onClick={() => setBand(band === key ? "" : key)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        band === key ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-500 hover:text-slate-700"
      }`}
      style={color && band !== key ? { color } : undefined}
    >
      {label} · {n.toLocaleString()}
    </button>
  );

  const flags = (f: Firm) => {
    const out: { t: string; c: string; b: string }[] = [];
    if (f.ofac === "hit") out.push({ t: "OFAC", c: "var(--text-danger)", b: "var(--bg-danger)" });
    else if (f.ofac === "review") out.push({ t: "OFAC?", c: "var(--text-warning)", b: "var(--bg-warning)" });
    if (f.sec === "hit" || f.sec === "review") out.push({ t: "SEC", c: "var(--text-warning)", b: "var(--bg-warning)" });
    if (f.iapd === "review") out.push({ t: "Not IA-reg", c: "var(--text-muted)", b: "var(--surface-1)" });
    return out;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search firms" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {chip("observed", "Observed", counts.observed)}
        {chip("single", "Single", counts.single)}
        {chip("registry", "Registry", counts.registry)}
        {chip("review", "Review", counts.review, "var(--text-warning)")}
        {chip("", "All firms", counts.total)}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          Min rank
          <input value={minRank} onChange={(e) => setMinRank(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" className="w-14 rounded-md border border-slate-200 px-2 py-1 text-center text-xs" />
        </span>
      </div>

      <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        Board-only signal — a fund writing a check with no board seat leaves no trace. A lead signal, not a cap table.
      </div>
      {note ? <p className="mb-3 text-xs font-medium text-indigo-700">{note}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
              <th className="w-12 px-3 py-2.5">SCORE</th>
              <th className="px-3 py-2.5">COMPANY</th>
              <th className="w-28 px-3 py-2.5">REMAINING</th>
              <th className="w-16 px-3 py-2.5">DAYS</th>
              <th className="w-24 px-3 py-2.5">STAGE</th>
              <th className="w-28 px-3 py-2.5">FLAGS</th>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-slate-500">Loading firms…</td></tr>
            ) : firms.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-slate-500">No firms match. Run the rollup to populate from investor filings.</td></tr>
            ) : (
              firms.map((f) => {
                const [bb, bt] = BAND[f.activity_band] ?? BAND.registry;
                return (
                  <tr key={f.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ background: f.formd_rank != null ? "var(--bg-success)" : "var(--surface-1)", color: f.formd_rank != null ? "var(--text-success)" : "var(--text-muted)" }}
                        title={f.formd_rank == null ? "Not rated (registry band)" : "Investor rank"}
                      >
                        {f.formd_rank != null ? Math.round(f.formd_rank) : "—"}
                      </span>
                    </td>
                    <td className="min-w-0 px-3 py-2.5">
                      <p className="truncate font-medium text-slate-900">{f.display_name}</p>
                      <p className="truncate text-[11px] text-slate-400">
                        {[f.city, f.state_or_country].filter(Boolean).join(", ") || "—"} · {f.vehicle_count} vehicle{f.vehicle_count === 1 ? "" : "s"}
                        {f.activity_band !== "registry" && f.last_investment_issuer ? ` · last: ${f.last_investment_issuer}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {fmtUsd(f.regd_footprint)}
                      <span className="block text-[10px] text-slate-400">Reg D (not AUM)</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{daysSince(f.last_investment_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: bb, color: bt }}>
                        {f.activity_band[0].toUpperCase() + f.activity_band.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {flags(f).length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          flags(f).map((fl) => (
                            <span key={fl.t} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: fl.b, color: fl.c }}>{fl.t}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {!canPromote ? null : f.promoted_at ? (
                        <span className="text-[11px] text-indigo-500">Promoted</span>
                      ) : f.ofac === "hit" ? (
                        <span title="OFAC hit — promote blocked" className="cursor-not-allowed rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-400">Blocked</span>
                      ) : (
                        <button type="button" disabled={busyId === f.id} onClick={() => promote(f)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                          {busyId === f.id ? "…" : "Promote"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
