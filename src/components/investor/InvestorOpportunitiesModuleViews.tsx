"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { ModuleEmptyState } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";

type ViewMode = "grid" | "list";

export type InvestorOpportunityRow = {
  companyId: string;
  companyName: string;
  slug: string | null;
  industry: string | null;
  stage: string | null;
  location: string | null;
  fundingTarget: string | null;
  publishedAt: string | null;
  readinessScore: number | null;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
  myPledgeAmount: number | null;
};

function scoreBucket(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function filterMatches(rows: InvestorOpportunityRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.companyName.toLowerCase().includes(q) ||
      (row.industry?.toLowerCase().includes(q) ?? false) ||
      (row.stage?.toLowerCase().includes(q) ?? false) ||
      (row.location?.toLowerCase().includes(q) ?? false),
  );
}

function MatchPill({ score }: { score: number }) {
  const bucket = scoreBucket(score);
  const cls =
    bucket === "high"
      ? "bg-emerald-50 text-emerald-700"
      : bucket === "medium"
        ? "bg-yellow-50 text-yellow-700"
        : "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {score}%
    </span>
  );
}

function ReadinessBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-700"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700">{score}</span>
    </div>
  );
}

function OpportunitiesTable({ rows }: { rows: InvestorOpportunityRow[] }) {
  if (rows.length === 0) {
    return (
      <ModuleEmptyState
        title="No matching opportunities"
        description="Adjust your search or browse the full marketplace."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Company
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Industry
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Stage
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Date listed
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Target raised
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Pledge amount
            </th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Readiness score
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.companyId}
              className="group transition-colors hover:bg-slate-50/60"
            >
              {/* Company */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                    {initials(row.companyName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{row.companyName}</span>
                      <MatchPill score={row.matchScore} />
                    </div>
                    {row.location ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.location}</p>
                    ) : null}
                  </div>
                </div>
              </td>

              {/* Industry */}
              <td className="px-4 py-3">
                {row.industry ? (
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                    {row.industry}
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>

              {/* Stage */}
              <td className="px-4 py-3">
                {row.stage ? (
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                    {row.stage}
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>

              {/* Date */}
              <td className="px-4 py-3 text-xs text-slate-500">
                {formatDate(row.publishedAt) ?? <span className="text-slate-300">—</span>}
              </td>

              {/* Target raised */}
              <td className="px-4 py-3 text-xs text-slate-700">
                {row.fundingTarget ?? <span className="text-slate-300">—</span>}
              </td>

              {/* Pledge amount */}
              <td className="px-4 py-3 text-xs text-slate-700">
                {row.myPledgeAmount != null ? (
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(row.myPledgeAmount)
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>

              {/* Readiness score */}
              <td className="px-4 py-3">
                <ReadinessBar score={row.readinessScore} />
              </td>

              {/* Actions */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/investor/opportunities/${row.companyId}/report`}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    View report
                  </Link>
                  <Link
                    href={`/investor/portfolio?add_company_id=${row.companyId}&company_name=${encodeURIComponent(row.companyName)}${row.slug ? `&slug=${row.slug}` : ""}`}
                    className="rounded-md border border-[#534AB7] bg-[#EEEDFE] px-2.5 py-1 text-[11px] font-medium text-[#534AB7] transition-colors hover:bg-[#534AB7] hover:text-white"
                  >
                    + Track
                  </Link>
                  {row.slug ? (
                    <Link
                      href={`/deals/${row.slug}`}
                      className="rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-700"
                    >
                      View →
                    </Link>
                  ) : (
                    <Link
                      href={`/investor/opportunities/${row.companyId}/report`}
                      className="rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-700"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestorOpportunitiesModuleViewsInner({ matches }: Readonly<{ matches: InvestorOpportunityRow[] }>) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const filtered = useMemo(() => filterMatches(matches, query), [matches, query]);

  const sortedByScore = useMemo(
    () => [...filtered].sort((a, b) => b.matchScore - a.matchScore),
    [filtered],
  );

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          No marketplace listings available yet, or complete investor onboarding to improve match quality.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies, sector, or stage…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["list", "grid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "list" ? "≡ List" : "⊟ Grid"}
            </button>
          ))}
        </div>
      </div>

      <PageSection
        title="Recommended for you"
        subtitle={`${filtered.length} match${filtered.length !== 1 ? "es" : ""} sorted by CapitalOS match score`}
      >
        {view === "list" ? (
          <OpportunitiesTable rows={sortedByScore} />
        ) : filtered.length === 0 ? (
          <ModuleEmptyState
            title="No matching opportunities"
            description="Adjust your search or browse the full marketplace."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(({ myPledgeAmount: _pledge, ...row }) => (
              <InvestorMatchOpportunityCard key={row.companyId} {...row} />
            ))}
          </div>
        )}
      </PageSection>
    </>
  );
}

export function InvestorOpportunitiesModuleViews(props: Readonly<{ matches: InvestorOpportunityRow[] }>) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading opportunities…</p>}>
      <InvestorOpportunitiesModuleViewsInner {...props} />
    </Suspense>
  );
}
