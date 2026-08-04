import Link from "next/link";

type Report = {
  readiness_score?: number | null;
  executive_summary?: string | null;
  business_overview?: string | null;
  financial_review?: string | null;
  market_review?: string | null;
  legal_review?: string | null;
  team_review?: string | null;
  risk_flags?: unknown;
  missing_documents?: unknown;
  created_at?: string | null;
};

function bandColor(score: number): { ring: string; text: string; label: string } {
  if (score >= 75) return { ring: "#0F6E56", text: "#085041", label: "Strong" };
  if (score >= 50) return { ring: "#BA7517", text: "#633806", label: "Developing" };
  return { ring: "#993C1D", text: "#4A1B0C", label: "Early" };
}

function count(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Compact preview of the latest AI diligence report — score, per-section review
 * status, executive summary, and a link to the full report. Section status is
 * "Reviewed" when the AI produced content for that area, else "Pending".
 */
export function DiligenceReportPreview({ report, readinessScore }: { report: Report; readinessScore: number }) {
  const score = report.readiness_score ?? readinessScore ?? 0;
  const band = bandColor(score);
  const sections: [string, string | null | undefined][] = [
    ["Team", report.team_review],
    ["Market", report.market_review],
    ["Financials", report.financial_review],
    ["Business", report.business_overview],
    ["Legal", report.legal_review],
  ];
  const risks = count(report.risk_flags);
  const missing = count(report.missing_documents);
  const summary = report.executive_summary?.trim();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full"
          style={{ border: `5px solid ${band.ring}` }}
        >
          <span className="text-[19px] font-semibold leading-none tabular-nums" style={{ color: band.text }}>{score}</span>
          <span className="text-[8px]" style={{ color: band.ring }}>% done</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Completion · {band.label}</p>
          {report.created_at ? (
            <p className="text-xs text-slate-400">Generated {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
            {risks > 0 ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">{risks} risk flag{risks === 1 ? "" : "s"}</span> : null}
            {missing > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{missing} doc{missing === 1 ? "" : "s"} missing</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sections.map(([label, body]) => {
          const done = Boolean(body?.trim());
          return (
            <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[12px]">
              <span className="text-slate-700">{label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {done ? "Reviewed" : "Pending"}
              </span>
            </div>
          );
        })}
      </div>

      {summary ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Executive summary</p>
          <p className="mt-1 text-[13px] leading-6 text-slate-700">{summary.length > 320 ? `${summary.slice(0, 320)}…` : summary}</p>
        </div>
      ) : null}

      <Link
        href="/founder/report"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2E78F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a6ce4]"
      >
        Open full report
      </Link>
    </div>
  );
}
