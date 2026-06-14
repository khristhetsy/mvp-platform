"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type WatchlistRow = {
  id: string;
  companyId: string;
  companyName: string;
  slug: string | null;
  industry: string | null;
  stage: string | null;
  location: string | null;
  dateSaved: string | null;
  status: string | null;
};

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

function StatusPill({ status }: { status: string | null }) {
  const label = status ?? "Saved";
  const cls =
    label.toLowerCase() === "interested"
      ? "bg-yellow-50 text-yellow-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
}

export function WatchlistPageClient({ rows }: Readonly<{ rows: WatchlistRow[] }>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.companyName.toLowerCase().includes(q) ||
        (r.industry?.toLowerCase().includes(q) ?? false) ||
        (r.stage?.toLowerCase().includes(q) ?? false) ||
        (r.location?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, query]);

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search watchlist…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <Link
          href="/deals"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Browse marketplace →
        </Link>
      </div>

      {/* Section label */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Saved deals · {filtered.length} {filtered.length === 1 ? "company" : "companies"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">
            {rows.length === 0
              ? "No saved deals yet. Browse the marketplace to start building your watchlist."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Company
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Industry
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Stage
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Date saved
                </th>
                <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-[9.5px] font-semibold uppercase tracking-wide text-slate-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/60">
                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                        {initials(row.companyName)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{row.companyName}</p>
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
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    {row.stage ? (
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                        {row.stage}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Date saved */}
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(row.dateSaved) ?? <span className="text-slate-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
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
                      {row.slug ? (
                        <Link
                          href={`/deals/${row.slug}`}
                          className="rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-700"
                        >
                          View opportunity →
                        </Link>
                      ) : (
                        <Link
                          href={`/investor/opportunities/${row.companyId}/report`}
                          className="rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-700"
                        >
                          View opportunity →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
