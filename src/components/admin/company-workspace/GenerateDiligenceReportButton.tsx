"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Staff-only: generate an AI diligence report for this company.
 * Calls POST /api/ai/reports (admin/analyst gated), which writes a row to
 * diligence_reports — that's what the founder's "AI diligence report" page reads.
 */
export function GenerateDiligenceReportButton({ companyId }: Readonly<{ companyId: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/ai/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const j = (await res.json()) as { error?: string; report?: { readiness_score?: number | null } };
      if (!res.ok) throw new Error(j.error ?? "Report generation failed.");
      const score = j.report?.readiness_score;
      setMsg(
        `Diligence report generated${typeof score === "number" ? ` — readiness ${score}` : ""}. The founder can now see it under Readiness → AI diligence report.`,
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Report generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate AI diligence report"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Builds an executive summary, risk flags, missing documents, and recommendations from this company&apos;s uploaded
        document summaries. Requires <code>ANTHROPIC_API_KEY</code>; the founder sees the result on their report page.
      </p>
      {msg ? <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p> : null}
      {err ? <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p> : null}
    </div>
  );
}
