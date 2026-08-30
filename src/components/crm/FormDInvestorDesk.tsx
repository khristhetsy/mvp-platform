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
  last_investment_issuer: string | null;
  last_investment_round_size: number | null;
  last_investment_confidence: number | null;
  est_check_size: number | null;
  investments_24mo: number;
  sectors_observed: string[] | null;
  activity_band: "observed" | "single" | "registry";
  formd_rank: number | null;
};

const fmtUsd = (n: number | null) => (n == null ? "—" : `$${(n / 1_000_000).toFixed(1)}M`);

const BAND: Record<string, { label: string; cls: string }> = {
  observed: { label: "Observed", cls: "bg-emerald-50 text-emerald-700" },
  single: { label: "Single", cls: "bg-amber-50 text-amber-700" },
  registry: { label: "Registry", cls: "bg-slate-100 text-slate-500" },
};

export function FormDInvestorDesk({ canPromote }: Readonly<{ canPromote: boolean }>) {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [q, setQ] = useState("");
  const [band, setBand] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (band) params.set("band", band);
      const res = await fetch(`/api/admin/crm/connectors/formd/firms?${params}`);
      const json = await res.json().catch(() => ({}));
      setFirms(json.firms ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, band]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function promote(firm: Firm) {
    const lawfulBasis = window.prompt(
      `Promote "${firm.display_name}" into the investor list.\nGDPR lawful basis (recorded per record):`,
      "legitimate_interest",
    );
    if (!lawfulBasis) return;
    setBusyId(firm.id);
    setNote(null);
    try {
      const res = await fetch("/api/admin/crm/connectors/formd/promote-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId: firm.id, lawfulBasis }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(res.status === 409 ? `Blocked: ${json.error}` : json.error ?? "Promote failed.");
      } else if (json.action === "review") {
        setNote(`${firm.display_name}: a similar investor already exists — held for review, not auto-created.`);
      } else {
        setNote(`${firm.display_name}: ${json.action === "matched" ? "matched an existing investor" : "added to the investor list"}.`);
        load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search firms"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select value={band} onChange={(e) => setBand(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <option value="">All bands</option>
          <option value="observed">Observed</option>
          <option value="single">Single</option>
          <option value="registry">Registry</option>
        </select>
      </div>

      <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        Board-only signal — a fund writing a check with no board seat leaves no trace here. This is a lead signal, not a cap table.
      </div>

      {note ? <p className="mb-3 text-xs font-medium text-indigo-700">{note}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading firms…</p>
      ) : firms.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No firms yet. Run the rollup to populate from investor-side Form D filings.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {firms.map((f) => {
              const observed = f.activity_band === "observed";
              const meta = BAND[f.activity_band] ?? BAND.registry;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{f.display_name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                      {f.needs_review ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Review</span> : null}
                      {f.promoted_at ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">Promoted</span> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[f.city, f.state_or_country].filter(Boolean).join(", ") || "—"} · {f.vehicle_count} vehicle{f.vehicle_count === 1 ? "" : "s"} · Reg D raised (not AUM): {fmtUsd(f.regd_footprint)}
                    </p>
                    {f.activity_band === "registry" ? (
                      <p className="mt-0.5 text-xs text-slate-400">Verified — no observed activity</p>
                    ) : (
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        Last: {f.last_investment_issuer ?? "—"} · Round: {fmtUsd(f.last_investment_round_size)}
                        {f.last_investment_confidence != null ? ` · conf ${f.last_investment_confidence}` : ""}
                        {observed && f.est_check_size != null ? ` · Est. check ~${fmtUsd(f.est_check_size)}` : ""}
                      </p>
                    )}
                  </div>
                  {f.activity_band !== "registry" && f.formd_rank != null ? (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{Math.round(f.formd_rank)}</p>
                      <p className="text-[10px] text-slate-400">rank</p>
                    </div>
                  ) : (
                    <div className="text-right text-[11px] text-slate-400">Verified,<br />not rated</div>
                  )}
                  {canPromote && !f.promoted_at ? (
                    <button
                      type="button"
                      disabled={busyId === f.id}
                      onClick={() => promote(f)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {busyId === f.id ? "…" : "Promote"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
