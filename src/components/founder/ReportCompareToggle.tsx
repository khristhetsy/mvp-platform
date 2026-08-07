"use client";

import { useState } from "react";
import { DiligenceReportCompare, type DiligenceReportRow } from "@/components/founder/DiligenceReportCompare";

/** Founder-facing "Compare with previous version" control. Shown only when at
 *  least two report versions exist; toggles the side-by-side comparison. */
export function ReportCompareToggle({
  current,
  previous,
}: {
  current: DiligenceReportRow;
  previous: DiligenceReportRow;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy,#0c2340)] transition-colors hover:bg-slate-50"
      >
        {open ? "Hide comparison" : "Compare with previous version"}
      </button>
      {open && (
        <div className="mt-4">
          <DiligenceReportCompare current={current} previous={previous} />
        </div>
      )}
    </div>
  );
}
