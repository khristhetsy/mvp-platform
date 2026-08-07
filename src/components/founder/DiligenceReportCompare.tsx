// Side-by-side comparison of two diligence report versions. Presentational and
// server-safe: pass the current + previous report rows (newest first). Sections
// that differ between the two versions are highlighted so changes are obvious.

export type DiligenceReportRow = {
  created_at: string;
  readiness_score: number | null;
  executive_summary: string | null;
  business_overview: string | null;
  financial_review: string | null;
  market_review: string | null;
  legal_review: string | null;
  team_review: string | null;
  risk_flags: string[] | null;
  missing_documents: string[] | null;
};

const TEXT_SECTIONS: { key: keyof DiligenceReportRow; label: string }[] = [
  { key: "executive_summary", label: "Executive summary" },
  { key: "business_overview", label: "Business overview" },
  { key: "financial_review", label: "Financial review" },
  { key: "market_review", label: "Market review" },
  { key: "legal_review", label: "Legal & compliance review" },
  { key: "team_review", label: "Team review" },
];

function norm(v: unknown): string {
  return (typeof v === "string" ? v : "").trim();
}
function normList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function Cell({ body, changed }: { body: string; changed: boolean }) {
  const empty = !body || body === "Not provided.";
  return (
    <div className={`rounded-lg border p-3 text-[13px] leading-6 ${changed ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
      {empty ? <span className="italic text-slate-400">{body || "—"}</span> : <span className="whitespace-pre-wrap text-slate-700">{body}</span>}
    </div>
  );
}

function ListCell({ items, changed }: { items: string[]; changed: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-[13px] leading-6 ${changed ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
      {items.length === 0 ? (
        <span className="italic text-slate-400">None</span>
      ) : (
        <ul className="list-disc space-y-1 pl-4 text-slate-700">
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}

export function DiligenceReportCompare({
  current,
  previous,
}: {
  current: DiligenceReportRow;
  previous: DiligenceReportRow;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 grid grid-cols-[160px_1fr_1fr] items-end gap-3">
        <div />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-600">Current version</p>
          <p className="text-sm font-semibold text-slate-900">{fmtDate(current.created_at)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">Previous version</p>
          <p className="text-sm font-semibold text-slate-600">{fmtDate(previous.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-[160px_1fr_1fr] items-center gap-3 border-t border-slate-100 py-3">
        <p className="text-xs font-semibold text-slate-500">Readiness score</p>
        <div className={`rounded-lg border p-3 text-lg font-semibold tabular-nums ${current.readiness_score !== previous.readiness_score ? "border-amber-200 bg-amber-50/50 text-slate-900" : "border-slate-200 bg-white text-slate-900"}`}>
          {current.readiness_score ?? "—"}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-lg font-semibold tabular-nums text-slate-600">
          {previous.readiness_score ?? "—"}
        </div>
      </div>

      {TEXT_SECTIONS.map(({ key, label }) => {
        const a = norm(current[key]);
        const b = norm(previous[key]);
        const changed = a !== b;
        return (
          <div key={key} className="grid grid-cols-[160px_1fr_1fr] items-start gap-3 border-t border-slate-100 py-3">
            <p className="pt-3 text-xs font-semibold text-slate-500">{label}{changed ? <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-700">changed</span> : null}</p>
            <Cell body={a} changed={changed} />
            <Cell body={b} changed={changed} />
          </div>
        );
      })}

      {([
        { key: "risk_flags" as const, label: "Risk flags" },
        { key: "missing_documents" as const, label: "Missing documents" },
      ]).map(({ key, label }) => {
        const a = normList(current[key]);
        const b = normList(previous[key]);
        const changed = a.join("|") !== b.join("|");
        return (
          <div key={key} className="grid grid-cols-[160px_1fr_1fr] items-start gap-3 border-t border-slate-100 py-3">
            <p className="pt-3 text-xs font-semibold text-slate-500">{label}{changed ? <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-700">changed</span> : null}</p>
            <ListCell items={a} changed={changed} />
            <ListCell items={b} changed={changed} />
          </div>
        );
      })}

      <p className="mt-4 text-xs text-slate-400">Highlighted rows differ between the two versions.</p>
    </div>
  );
}
