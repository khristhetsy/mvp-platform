"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  mirrored: number; operating: number; funds: number; unpromoted: number; promoted: number;
  founders?: { mirrored: number; promoted: number; toReview: number };
  investors?: { firms: number; promoted: number; toReview: number };
};
type Health = { name: string; value: string; severity: "ok" | "warn" | "page" };

const SEV: Record<Health["severity"], string> = { ok: "text-emerald-700", warn: "text-amber-700", page: "text-rose-700" };

export function FormDConnectorCard({ canPromote }: { canPromote: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health[]>([]);
  const [uaOk, setUaOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/crm/connectors/formd");
        if (!res.ok) return;
        const j = await res.json();
        if (!active) return;
        setStats(j.stats ?? null);
        setHealth(j.health ?? []);
        setUaOk(Boolean(j.userAgentConfigured));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function test() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/admin/crm/connectors/formd/test", { method: "POST" });
      const j = await res.json();
      setTestMsg(j.message ?? (res.ok ? "Connected." : "Failed."));
    } catch {
      setTestMsg("Could not reach EDGAR.");
    } finally {
      setTesting(false);
    }
  }

  const tiles: Array<[string, number | undefined]> = [
    ["Filings mirrored", stats?.mirrored],
    ["Operating", stats?.operating],
    ["Funds", stats?.funds],
    ["Unpromoted", stats?.unpromoted],
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "#0A1A40" }}><i className="ti ti-building-bank" aria-hidden="true" /></span>
            <h2 className="text-base font-semibold text-slate-950">SEC EDGAR — Form D</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${uaOk ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{uaOk ? "Configured" : "User-Agent not set"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">Mirrors Form D filings as capital-advisory leads. EDGAR stays the system of record; refreshed daily at 09:00 CET.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={test} disabled={testing} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{testing ? "Testing…" : "Test connection"}</button>
          <Link href="/admin/crm/connectors/formd" className="rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: "#1A6CE4" }}>Review filings →</Link>
        </div>
      </div>

      {testMsg && <p className="mt-2 text-xs text-slate-600">{testMsg}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, val]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-lg font-semibold text-slate-900">{loading ? "—" : (val ?? 0).toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <i className="ti ti-rocket text-[13px] text-indigo-600" aria-hidden="true" />
            <span className="text-xs font-medium text-indigo-700">Founders</span>
            <span className="text-[10px] text-slate-400">issuer filings</span>
          </div>
          <div className="flex gap-4">
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.founders?.mirrored ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">mirrored</div></div>
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.founders?.promoted ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">promoted</div></div>
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.founders?.toReview ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">to review</div></div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <i className="ti ti-building-bank text-[13px] text-blue-600" aria-hidden="true" />
            <span className="text-xs font-medium text-blue-700">Investors</span>
            <span className="text-[10px] text-slate-400">funds &amp; firms</span>
          </div>
          <div className="flex gap-4">
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.investors?.firms ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">firms</div></div>
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.investors?.promoted ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">promoted</div></div>
            <div><div className="text-base font-semibold text-slate-900">{loading ? "—" : (stats?.investors?.toReview ?? 0).toLocaleString()}</div><div className="text-[10px] text-slate-500">to review</div></div>
          </div>
        </div>
      </div>

      {health.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {health.map((h) => (
            <span key={h.name} className={SEV[h.severity]}>{h.name}: {h.value}</span>
          ))}
        </div>
      )}

      {!canPromote && <p className="mt-2 text-[11px] text-slate-500">Analyst view — promoting filings to contacts is admin-only.</p>}
    </div>
  );
}
