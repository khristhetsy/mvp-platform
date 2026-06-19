"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MatchingCenterPairRow } from "@/lib/matching/matching-center";

type ActivityKey = `${string}::${string}`;

function activityKey(investorId: string, companyId: string): ActivityKey {
  return `${investorId}::${companyId}`;
}

function scoreClass(score: number) {
  if (score >= 80) return { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800" };
  if (score >= 70) return { bar: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-800" };
  return { bar: "bg-slate-400", badge: "bg-slate-100 text-slate-700" };
}

export function AdminUncontactedMatchesPanel({
  pairs,
  existingActivity,
}: Readonly<{
  pairs: MatchingCenterPairRow[];
  existingActivity: Array<{ investorId: string; companyId: string }>;
}>) {
  const activitySet = useMemo<Set<ActivityKey>>(() => {
    const s = new Set<ActivityKey>();
    for (const row of existingActivity) {
      s.add(activityKey(row.investorId, row.companyId));
    }
    return s;
  }, [existingActivity]);

  const uncontacted = useMemo(() => {
    return pairs
      .filter(
        (p) =>
          p.matchScore >= 70 &&
          !activitySet.has(activityKey(p.investorId, p.companyId)),
      )
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);
  }, [pairs, activitySet]);

  if (uncontacted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-4 text-sm text-emerald-800">
        All high-match pairs have existing investor activity — no uncontacted pairs to surface.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {uncontacted.map((pair) => {
        const sc = scoreClass(pair.matchScore);
        return (
          <div
            key={`${pair.investorId}-${pair.companyId}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Names */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${sc.badge}`}
                  >
                    {pair.matchScore}% match
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">
                  {pair.investorName}
                  <span className="mx-1.5 font-normal text-slate-400">↔</span>
                  {pair.companyName}
                </p>
                {pair.investorType && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {pair.investorType}
                    {pair.industry ? ` · ${pair.industry}` : ""}
                    {pair.companyGeography ? ` · ${pair.companyGeography}` : ""}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Link
                  href={`/admin/investors?investor=${pair.investorId}`}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View investor →
                </Link>
                <Link
                  href={`/admin/companies/${pair.companyId}`}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View company →
                </Link>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${sc.bar} transition-all`}
                style={{ width: `${pair.matchScore}%` }}
              />
            </div>

            {/* Match reasons */}
            {pair.matchReasons.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {pair.matchReasons.slice(0, 3).map((reason, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-inset ring-slate-200"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
