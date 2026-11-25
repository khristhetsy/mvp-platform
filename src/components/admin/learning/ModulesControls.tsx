"use client";

import { useRouter } from "next/navigation";
import { toModulesCsv, type ModuleExportRow } from "@/lib/learning/modules-csv";

type StageOption = Readonly<{ value: string; label: string }>;

/** Filters the capital stage modules table by stage, using the page URL so the server renders the result. */
export function StageFilter({ value, options }: Readonly<{ value: string; options: readonly StageOption[] }>) {
  const router = useRouter();
  return (
    <select
      aria-label="Filter capital stage modules by stage"
      value={value}
      onChange={(e) => router.push(e.target.value ? `/admin/learning?stage=${encodeURIComponent(e.target.value)}` : "/admin/learning")}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
    >
      <option value="">All stages</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ExportModulesButton({ rows }: Readonly<{ rows: readonly ModuleExportRow[] }>) {
  function download() {
    const blob = new Blob([toModulesCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning-capital-stage-modules.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button type="button" onClick={download} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
      Export
    </button>
  );
}
