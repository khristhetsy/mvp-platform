"use client";

import Link from "next/link";
import { useState } from "react";

type WatchlistRow = {
  id: string;
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  dateSaved: string | null;
  status: string | null;
  notes: string | null;
};

type CompareSlot = 0 | 1 | 2;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const FIELD_ROWS: Array<{
  label: string;
  render: (row: WatchlistRow) => string;
}> = [
  { label: "Industry",   render: (r) => r.industry  ?? "—" },
  { label: "Stage",      render: (r) => r.stage     ?? "—" },
  { label: "Location",   render: (r) => r.location  ?? "—" },
  { label: "Date saved", render: (r) => formatDate(r.dateSaved) },
  { label: "Status",     render: (r) => r.status    ?? "—" },
  { label: "Note",       render: (r) => r.notes ? r.notes.slice(0, 80) + (r.notes.length > 80 ? "…" : "") : "—" },
];

export function InvestorDealComparisonPanel({ rows }: { rows: WatchlistRow[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<[string, string, string]>(["", "", ""]);

  if (rows.length < 2) return null;

  const selectedRows = selected.map((id) => rows.find((r) => r.companyId === id) ?? null);
  const activeCount = selected.filter(Boolean).length;

  function setSlot(slot: CompareSlot, companyId: string) {
    const next: [string, string, string] = [...selected] as [string, string, string];
    next[slot] = companyId;
    setSelected(next);
  }

  const SELECT_PLACEHOLDER = "Select company…";

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Compare deals</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Side-by-side comparison of up to 3 watchlisted companies
          </p>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
          {/* Slot selectors */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {([0, 1, 2] as CompareSlot[]).map((slot) => (
              <div key={slot}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Company {slot + 1}
                </label>
                <select
                  value={selected[slot]}
                  onChange={(e) => setSlot(slot, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {rows.map((r) => (
                    <option
                      key={r.companyId}
                      value={r.companyId}
                      disabled={selected.some((id, i) => id === r.companyId && i !== slot)}
                    >
                      {r.companyName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {activeCount < 2 ? (
            <p className="text-center text-sm text-slate-400">
              Select at least 2 companies to compare
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="w-32 pb-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Field
                    </th>
                    {selectedRows.map((row, i) =>
                      row ? (
                        <th key={i} className="pb-3 pl-4 text-left">
                          <Link
                            href={`/investor/opportunities/${row.companyId}/report`}
                            className="font-semibold text-indigo-700 hover:text-indigo-900"
                          >
                            {row.companyName}
                          </Link>
                        </th>
                      ) : null,
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FIELD_ROWS.map(({ label, render }) => (
                    <tr key={label}>
                      <td className="py-2.5 pr-4 text-[11px] font-semibold text-slate-500">
                        {label}
                      </td>
                      {selectedRows.map((row, i) =>
                        row ? (
                          <td key={i} className="py-2.5 pl-4 text-xs text-slate-700">
                            {render(row)}
                          </td>
                        ) : null,
                      )}
                    </tr>
                  ))}
                  {/* Links row */}
                  <tr>
                    <td className="pt-3 pr-4 text-[11px] font-semibold text-slate-500">Report</td>
                    {selectedRows.map((row, i) =>
                      row ? (
                        <td key={i} className="pt-3 pl-4">
                          <Link
                            href={`/investor/opportunities/${row.companyId}/report`}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            View →
                          </Link>
                        </td>
                      ) : null,
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
