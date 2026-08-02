"use client";

import { useMemo, useState } from "react";

/**
 * Investor mandate explorer (spec §5, §7). Two halves:
 *  1) Plain-English mandate → /api/ai task "parse_mandate" → sets the filters.
 *  2) Filters drive a live fit recompute over FICTIONAL sample companies (§13) —
 *     no live offerings, no real deal data. Match logic is illustrative only.
 */

type Filter = { label: string; options: readonly string[] };

// Fictional sample records — illustrative of fit logic only (§13).
const SAMPLES = [
  { name: "Northwind Labs", sector: "Climate", stage: "Seed", check: "$500K – $2M" },
  { name: "Ledgerly", sector: "Fintech", stage: "Series A", check: "$2M – $5M" },
  { name: "Cohort Health", sector: "Healthcare", stage: "Series A", check: "$2M – $5M" },
  { name: "Pallet", sector: "B2B software", stage: "Seed", check: "Under $500K" },
  { name: "Evergreen Grid", sector: "Climate", stage: "Series B+", check: "$5M+" },
  { name: "Basket", sector: "Consumer", stage: "Pre-seed", check: "Under $500K" },
  { name: "Forge Analytics", sector: "B2B software", stage: "Series A", check: "$500K – $2M" },
] as const;

// parse_mandate enum → display option for each select.
const SECTOR_MAP: Record<string, string> = { software: "B2B software", fintech: "Fintech", healthcare: "Healthcare", consumer: "Consumer", climate: "Climate", deeptech: "All sectors", industrials: "All sectors", other: "All sectors" };
const STAGE_MAP: Record<string, string> = { pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A", series_b: "Series B+", growth: "Series B+", other: "Any stage" };
const CHECK_MAP: Record<string, string> = { under_50k: "Under $500K", "50k_250k": "Under $500K", "250k_1m": "$500K – $2M", "1m_5m": "$2M – $5M", "5m_plus": "$5M+" };

function neutral(v: string) {
  return v === "All sectors" || v === "Any stage" || v === "Any size";
}

function fitFor(row: (typeof SAMPLES)[number], sector: string, stage: string, check: string): number {
  let score = 55;
  score += neutral(sector) ? 8 : row.sector === sector ? 15 : -8;
  score += neutral(stage) ? 8 : row.stage === stage ? 15 : -8;
  score += neutral(check) ? 8 : row.check === check ? 15 : -6;
  return Math.max(20, Math.min(99, score));
}

export function MandateExplorer({
  parseLabel,
  parseChips,
  parseCta,
  filters,
  note,
}: {
  parseLabel: string;
  parseChips: readonly string[];
  parseCta: string;
  filters: readonly Filter[];
  note: string;
}) {
  const [sector, setSector] = useState(filters[0].options[0]);
  const [stage, setStage] = useState(filters[1].options[0]);
  const [check, setCheck] = useState(filters[2].options[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<string | null>(null);
  const [note2, setNote2] = useState<string | null>(null);

  const ranked = useMemo(
    () => SAMPLES.map((r) => ({ ...r, fit: fitFor(r, sector, stage, check) })).sort((a, b) => b.fit - a.fit),
    [sector, stage, check],
  );

  async function parse(source: string) {
    const clean = source.trim();
    if (!clean) return;
    setText(clean);
    setBusy(true);
    setNote2(null);
    setRead(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "parse_mandate", messages: [{ role: "user", content: clean }] }),
      });
      if (res.status === 429) {
        const d = await res.json().catch(() => null);
        setNote2(d?.error ?? "You've hit the request limit — please try again shortly.");
        return;
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: { sector: string; stage: string; check: string; read: string } } | null;
      if (data?.ok && data.data) {
        setSector(SECTOR_MAP[data.data.sector] ?? filters[0].options[0]);
        setStage(STAGE_MAP[data.data.stage] ?? filters[1].options[0]);
        setCheck(CHECK_MAP[data.data.check] ?? filters[2].options[0]);
        setRead(data.data.read);
      } else {
        setNote2("Couldn't read that mandate. Try the chips, or set the filters directly below.");
      }
    } catch {
      setNote2("Network trouble. Set the filters directly below instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-site-line bg-site-paper p-6">
      <label htmlFor="mandate-input" className="text-sm font-medium text-site-navy">{parseLabel}</label>
      <textarea
        id="mandate-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={4000}
        placeholder="e.g. Early-stage climate hardware, $500K–$2M checks, US-based"
        className="mt-2 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {parseChips.map((c) => (<button key={c} type="button" onClick={() => parse(c)} className="rounded-full border border-site-line bg-white px-3 py-1 text-[13px] text-site-ink transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{c}</button>))}
        <button type="button" onClick={() => parse(text)} disabled={busy} className="ml-auto rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">{busy ? "Reading…" : parseCta}</button>
      </div>

      {read ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[13px] leading-6 text-site-ink" role="status" aria-live="polite">{read}</p> : null}
      {note2 ? <p className="mt-3 rounded-lg bg-site-amber/10 px-3 py-2 text-[13px] text-site-amber" role="status">{note2}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Select label={filters[0].label} value={sector} onChange={setSector} options={filters[0].options} />
        <Select label={filters[1].label} value={stage} onChange={setStage} options={filters[1].options} />
        <Select label={filters[2].label} value={check} onChange={setCheck} options={filters[2].options} />
      </div>

      <div className="mt-5" role="status" aria-live="polite">
        <div className="font-site-mono text-[11px] uppercase tracking-wide text-site-muted">Sample matches — recompute as you change the criteria</div>
        <ul className="mt-2 space-y-1.5">
          {ranked.map((r) => (
            <li key={r.name} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
              <span className="w-10 shrink-0 font-site-mono text-sm font-semibold text-site-blue">{r.fit}</span>
              <span className="flex-1 text-sm font-medium text-site-navy">{r.name}</span>
              <span className="hidden font-site-mono text-[11px] text-site-muted sm:inline">{r.sector} · {r.stage}</span>
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-site-line"><span className="block h-full rounded-full bg-site-blue" style={{ width: `${r.fit}%` }} /></span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 font-site-mono text-[11px] text-site-muted/70">{note}</p>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="text-[13px] text-site-muted">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi">
        {options.map((o) => (<option key={o}>{o}</option>))}
      </select>
    </label>
  );
}
