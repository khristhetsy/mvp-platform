"use client";

import Link from "next/link";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import { getCompanyWorkspaceHref, getInvestorWorkspaceHref } from "@/lib/ui/drilldown-links";

function formatActivityLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

type Props = {
  activities: AdminCrmActivityRow[];
};

export function AdminInvestorCrmTimeline({ activities }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-base font-semibold text-slate-950">Recent Activity</h2>
        <p className="mt-1 text-sm text-slate-500">Latest investor actions tracked for pipeline follow-up.</p>
      </div>

      <div className="divide-y divide-slate-100">
        {activities.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No CRM activity logged yet.</p>
        ) : (
          activities.map((row) => {
            const investor = row.investor_name ?? row.investor_email ?? "Unknown investor";
            return (
              <div key={row.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {row.investor_id ? (
                    <Link href={getInvestorWorkspaceHref(row.investor_id)} className="font-medium text-indigo-700 hover:text-indigo-900">
                      {investor}
                    </Link>
                  ) : (
                    <p className="font-medium text-slate-900">{investor}</p>
                  )}
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                    {formatActivityLabel(row.activity_type)}
                  </span>
                  {row.pipeline_stage ? (
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                      Pipeline: {formatActivityLabel(row.pipeline_stage)}
                    </span>
                  ) : null}
                </div>
                {row.company_id ? (
                  <Link href={getCompanyWorkspaceHref(row.company_id)} className="text-indigo-700 hover:text-indigo-900">
                    {row.company_name ?? "Unknown company"}
                  </Link>
                ) : (
                  <p className="text-slate-600">{row.company_name ?? "Unknown company"}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
