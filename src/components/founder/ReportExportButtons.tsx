"use client";

/**
 * Download / Print actions for the founder's AI diligence report.
 * Print opens the PDF inline in a new tab so the browser's PDF viewer prints a
 * clean document (no app chrome), rather than relying on print stylesheets.
 */
export function ReportExportButtons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="/api/founder/report/pdf?download=1"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E78F5] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1A6CE4]"
      >
        ⬇ Download PDF
      </a>
      <a
        href="/api/founder/report/pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        🖨 Print
        <span className="sr-only">(opens the PDF in a new tab)</span>
      </a>
    </div>
  );
}
