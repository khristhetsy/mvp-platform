"use client";

/**
 * Proof tab on Capital Readiness Rating: the figures behind a Founder CRR award
 * entry, from platform records. Landing view for all founders; search selects
 * one company, which then shows alone.
 */
import { useEffect, useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import {
  CSV_HEADER, changeOf, csvRow, emailFor, isFullyProven, isMeasured, proofStats, signed,
  type ProofCompany, type ProofPayload,
} from "@/lib/crr/proof";
import { ProofDashboard } from "@/components/admin/crr/ProofDashboard";
import { ProofCompanyView } from "@/components/admin/crr/ProofCompanyView";

const QUICK = [
  { key: "measured", label: "Has before and after" },
  { key: "no_baseline", label: "No before and after" },
  { key: "quote_yes", label: "Quote permission yes" },
  { key: "has_activity", label: "Has platform activity" },
  { key: "proven", label: "Proven on all three" },
];

const FIELDS: Array<SearchField<ProofCompany>> = [
  { label: "company", get: (c) => c.companyName },
  { label: "founder", get: (c) => c.founderName },
  { label: "email", get: (c) => c.founderEmail },
  { label: "stage", get: (c) => c.profileLabel },
  { label: "industry", get: (c) => c.industry },
];

const quickOk: Record<string, (c: ProofCompany) => boolean> = {
  measured: isMeasured,
  no_baseline: (c) => !isMeasured(c),
  quote_yes: (c) => c.quote === "yes",
  has_activity: (c) => !!c.activity,
  proven: isFullyProven,
};

const PRINT_CSS = `@media print{body *{visibility:hidden}.proof-print,.proof-print *{visibility:visible}.proof-print{position:absolute;left:0;top:0;width:100%}.no-print{display:none !important}}`;

export function ProofTab() {
  const [data, setData] = useState<ProofPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [sel, setSel] = useState<string | null>(null);
  const [share, setShare] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/crr/proof")
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => { if (!live) return; if (ok) setData(j as ProofPayload); else setError((j as { error?: string }).error ?? "Couldn't load the proof data."); })
      .catch(() => { if (live) setError("Couldn't load the proof data."); });
    return () => { live = false; };
  }, []);

  const all = useMemo(() => data?.companies ?? [], [data]);
  const filtered = useMemo(() => {
    const byQuick = all.filter((c) => search.quick.every((k) => quickOk[k]?.(c) ?? true));
    return matchRows(byQuick, FIELDS, search.q);
  }, [all, search.q, search.quick]);

  const gate = data?.gate ?? 65;
  const company = sel ? all.find((c) => c.companyId === sel) ?? null : null;
  const stats = useMemo(() => proofStats(filtered.rows, gate), [filtered.rows, gate]);
  const searching = search.q.trim() !== "" || search.quick.length > 0;

  const items: GearItem[] = [
    { key: "csv", icon: "ti-download", label: "Export CSV", hint: company ? "This founder" : "Founders in view", onClick: () => downloadCsv(company ? `crr-proof-${company.companyName}.csv` : "crr-proof.csv", CSV_HEADER, (company ? [company] : filtered.rows).map(csvRow)) },
    { key: "pdf", icon: "ti-printer", label: "Print / Save as PDF", onClick: () => window.print() },
    { key: "mail", icon: "ti-mail", label: "Share by email", sep: true, onClick: () => setShare(true) },
  ];

  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-500">Loading proof data…</p>;

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <OdooSearchBar scope="crr-proof" state={search} onChange={(s) => { setSearch(s); setSel(null); }} quick={QUICK} fields={[]} groups={[]} noGroupId="none" placeholder="Search company, founder, email, stage…" width={520} />
        <ToolbarGear items={items} />
        {company ? <button type="button" onClick={() => setSel(null)} className="text-[12.5px] font-semibold text-indigo-600 hover:underline">All founders</button> : null}
        <SearchCount result={filtered} noun="founders" className="ml-auto" />
      </div>

      <div className="proof-print">
        {company ? (
          <ProofCompanyView c={company} gate={gate} />
        ) : filtered.active && filtered.rows.length === 0 ? (
          <NoSearchMatches query={search.q} fields={FIELDS.map((f) => f.label)} onClear={() => setSearch(EMPTY_SEARCH)} />
        ) : (
          <>
            <ProofDashboard list={filtered.rows} stats={stats} gate={gate} onOpen={setSel} />
            {searching ? (
              <div className="no-print mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-[12.5px]">
                  <thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500"><th className="p-2.5">Company</th><th>Stage</th><th>First</th><th>Latest</th><th>Change</th><th>Quote</th></tr></thead>
                  <tbody>
                    {filtered.rows.map((c) => (
                      <tr key={c.companyId} onClick={() => setSel(c.companyId)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{c.companyName}</td>
                        <td>{c.profileLabel}</td>
                        <td className="tabular-nums">{c.first?.score ?? "n/a"}</td>
                        <td className="tabular-nums">{c.latest?.score ?? "n/a"}</td>
                        <td className="tabular-nums">{changeOf(c) === null ? "n/a" : signed(changeOf(c) as number)}</td>
                        <td>{c.quote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>

      {share ? <ShareDialog company={company} stats={stats} onClose={() => setShare(false)} /> : null}
    </div>
  );
}

function ShareDialog({ company, stats, onClose }: { company: ProofCompany | null; stats: ReturnType<typeof proofStats>; onClose: () => void }) {
  const draft = useMemo(() => emailFor(company, stats, ["[Your name]"]), [company, stats]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Share by email">
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-slate-900">Share by email</h3>
        <p className="mt-1 text-[12px] text-slate-500">Save the report as a PDF first, then attach it. Your email app cannot attach it for you.</p>
        <label className="mt-3 block text-[12px] font-semibold text-slate-700">To<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] font-normal" /></label>
        <label className="mt-2 block text-[12px] font-semibold text-slate-700">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] font-normal" /></label>
        <label className="mt-2 block text-[12px] font-semibold text-slate-700">Message<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] font-normal" /></label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); setCopied(true); } catch { setCopied(false); } }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">{copied ? "Copied" : "Copy draft"}</button>
          <a href={mailto} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Open in email app</a>
        </div>
      </div>
    </div>
  );
}
