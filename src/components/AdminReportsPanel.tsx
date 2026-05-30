"use client";

import { useMemo, useState } from "react";
import type { AdminReportPayload, AdminReportType } from "@/lib/reports/admin-reports";

const REPORT_OPTIONS: { value: AdminReportType; label: string; description: string }[] = [
  {
    value: "compliance",
    label: "Compliance report",
    description: "Compliance events, severity, and review status.",
  },
  {
    value: "founder_readiness",
    label: "Founder readiness report",
    description: "Companies, diligence scores, remediation, and learning progress.",
  },
  {
    value: "investor_activity",
    label: "Investor activity report",
    description: "Interests, activity log, and investor profile approvals.",
  },
  {
    value: "outreach_activity",
    label: "Outreach activity report",
    description: "Campaigns, social drafts, targets, and message metadata (no contact PII).",
  },
  {
    value: "messaging_meetings",
    label: "Messaging & meetings report",
    description: "Threads, meetings, message metadata, and platform notifications.",
  },
  {
    value: "subscription_upgrade",
    label: "Subscription & upgrade report",
    description: "Plans, subscription status, and upgrade requests.",
  },
  {
    value: "due_diligence",
    label: "Due Diligence Report",
    description:
      "Review company readiness, diligence findings, document status, remediation tasks, admin reviews, and investor-readiness indicators.",
  },
];

type FilterOption = { id: string; label: string };

function DueDiligencePreview({
  sections,
  isPreview,
}: Readonly<{
  sections: Record<string, Record<string, unknown>[]>;
  isPreview: boolean;
}>) {
  const companies = sections.company_diligence ?? [];
  const topRisk = sections.top_risk_companies ?? [];
  const distribution = sections.readiness_distribution ?? [];

  return (
    <div className="mt-6 space-y-6">
      {distribution.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness distribution</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {distribution.map((row) => (
              <span
                key={String(row.bucket)}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
              >
                {String(row.bucket)}: {String(row.count)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {topRisk.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top risk companies</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {topRisk.map((row) => (
              <li key={String(row.company_id)}>
                <span className="font-medium">{String(row.company_name)}</span>
                <span className="text-slate-500">
                  {" "}
                  · risk {String(row.risk_score)} · readiness {String(row.latest_readiness_score ?? "—")} · open
                  compliance {String(row.open_compliance_events)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Company diligence table ({companies.length} rows{isPreview ? ", preview capped" : ""})
        </p>
        {companies.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No companies match current filters.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Readiness</th>
                  <th className="px-3 py-2">Onboarding</th>
                  <th className="px-3 py-2">Docs</th>
                  <th className="px-3 py-2">Remediation</th>
                  <th className="px-3 py-2">Compliance</th>
                  <th className="px-3 py-2">Investor signals</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((row) => (
                  <tr key={String(row.company_id)} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{String(row.company_name)}</td>
                    <td className="px-3 py-2">{String(row.latest_readiness_score ?? "—")}</td>
                    <td className="px-3 py-2">{String(row.onboarding_progress_percent)}%</td>
                    <td className="px-3 py-2">
                      {String(row.document_count)} · deck {row.pitch_deck_present ? "yes" : "no"}
                    </td>
                    <td className="px-3 py-2">
                      open {String(row.remediation_open)} · hi-pri {String(row.remediation_high_priority_open)}
                    </td>
                    <td className="px-3 py-2">open {String(row.open_compliance_events)}</td>
                    <td className="px-3 py-2">
                      interests {String(row.expressed_interest_count)} · pledge {String(row.indicative_pledge_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminReportsPanel({
  companies,
  founders,
  investors,
}: Readonly<{
  companies: FilterOption[];
  founders: FilterOption[];
  investors: FilterOption[];
}>) {
  const [reportType, setReportType] = useState<AdminReportType>("compliance");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [founderId, setFounderId] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [severity, setSeverity] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminReportPayload | null>(null);

  const selectedReport = useMemo(
    () => REPORT_OPTIONS.find((option) => option.value === reportType),
    [reportType],
  );

  function buildFilters() {
    const filters: Record<string, string> = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (companyId) filters.companyId = companyId;
    if (founderId) filters.founderId = founderId;
    if (investorId) filters.investorId = investorId;
    if (severity) filters.severity = severity;
    if (reviewStatus) filters.reviewStatus = reviewStatus;
    return filters;
  }

  async function runRequest(options: { preview: boolean; format: "json" | "csv" }) {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType,
        format: options.format,
        preview: options.preview,
        filters: buildFilters(),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to generate report.");
      return;
    }

    if (options.preview) {
      const payload = (await response.json()) as { report: AdminReportPayload };
      setPreview(payload.report);
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `capitalos-${reportType}.${options.format}`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Generate report</h2>
        <p className="mt-1 text-xs text-slate-500">
          Internal audit exports only. OAuth tokens and private contact details are excluded.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Report type</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as AdminReportType)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {reportType === "compliance" || reportType === "due_diligence" ? (
            <label className="block text-sm">
              <span className="text-slate-600">Severity (optional)</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">All severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          ) : null}

          {reportType === "due_diligence" ? (
            <label className="block text-sm">
              <span className="text-slate-600">Review status (optional)</span>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="changes_requested">Changes requested</option>
              </select>
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="text-slate-600">Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Company (optional)</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Founder (optional)</span>
            <select
              value={founderId}
              onChange={(e) => setFounderId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">All founders</option>
              {founders.map((founder) => (
                <option key={founder.id} value={founder.id}>
                  {founder.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Investor (optional)</span>
            <select
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">All investors</option>
              {investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedReport ? (
          <p className="mt-3 text-xs text-slate-500">{selectedReport.description}</p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runRequest({ preview: true, format: "json" })}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Preview summary
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runRequest({ preview: false, format: "json" })}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            Download JSON
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runRequest({ preview: false, format: "csv" })}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Preview — {preview.meta.reportType}</h3>
          <p className="mt-1 text-xs text-slate-500">{preview.meta.privacyNotice}</p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(preview.summary).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white px-3 py-2 text-sm">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="font-medium text-slate-900">{String(value)}</dd>
              </div>
            ))}
          </dl>

          {preview.meta.reportType === "due_diligence" ? (
            <DueDiligencePreview sections={preview.sections} isPreview={preview.meta.preview} />
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(preview.sections).map(([section, rows]) => (
                <div key={section}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {section} ({rows.length} rows{preview.meta.preview ? ", preview capped" : ""})
                  </p>
                  {rows.length > 0 ? (
                    <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-white p-2 text-xs text-slate-700">
                      {JSON.stringify(rows.slice(0, 3), null, 2)}
                      {rows.length > 3 ? "\n…" : ""}
                    </pre>
                  ) : (
                    <p className="text-xs text-slate-500">No rows for current filters.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
