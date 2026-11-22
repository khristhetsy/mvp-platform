"use client";

import { useEffect, useState } from "react";
import { TERM_SHEET_FORMS } from "@/lib/term-sheet/fields";
import type { TermSheet } from "@/lib/term-sheet/types";

/** Read only list of a company's term sheets for the admin workspace. */
export function CompanyTermSheetsPanel({ companyId }: Readonly<{ companyId: string }>) {
  const [sheets, setSheets] = useState<TermSheet[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch(`/api/admin/companies/${companyId}/term-sheets`)
      .then((r) => r.json())
      .then((j) => on && setSheets((j.termSheets as TermSheet[]) ?? []))
      .catch(() => {})
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [companyId]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!sheets || sheets.length === 0) return <p className="text-sm text-slate-500">No term sheet started yet.</p>;

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {sheets.map((s) => {
        const filled = Object.keys(s.values).length;
        return (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800">{TERM_SHEET_FORMS[s.formType].label}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-0.5 font-medium ${s.status === "finalized" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {s.status === "finalized" ? "Uploaded to Documents" : "Draft"}
              </span>
              <span>{s.source === "round_structure" ? "From Round structure" : s.source === "uploaded" ? "From an uploaded file" : "From scratch"}</span>
              <span>{filled} blanks filled</span>
              <span>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ""}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
