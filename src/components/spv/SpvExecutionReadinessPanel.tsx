import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";
import { useTranslations } from "next-intl";
import { formatDocuSignStatusLabel } from "@/lib/document-execution/display";

export function SpvExecutionReadinessPanel({
  summary,
  compact = false,
}: Readonly<{
  summary: SpvExecutionReadinessSummary;
  compact?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  if (compact) {
    return (
      <p className="text-xs text-violet-800">
        Document execution: {summary.executionReadinessPct}% packages · {summary.signerReadinessPct}% signers ·{" "}
        {formatDocuSignStatusLabel(summary)}
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
        Document execution readiness (Phase 1)
      </p>
      <p className="mt-1 text-xs text-violet-900">
        Execution {summary.executionReadinessPct}% · Signers {summary.signerReadinessPct}% ·{" "}
        {formatDocuSignStatusLabel(summary)}
      </p>
      <p className="mt-1 text-xs text-slate-700">
        <span className="font-medium">{t("next")}</span> {summary.nextRequiredStep}
      </p>
      {summary.blockedPackages.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-900">
          {summary.blockedPackages.map((pkg) => (
            <li key={pkg.kind}>
              ○ {pkg.label}
              {pkg.blockedReason ? ` — ${pkg.blockedReason}` : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-2 space-y-1 text-xs text-slate-700">
        {summary.signers.map((signer) => (
          <li key={signer.signerType} className={signer.status === "present" ? "text-emerald-800" : "text-amber-900"}>
            {signer.status === "present" ? "✓" : "○"} {signer.label}
            {signer.presentCount > 0 || signer.requiredCount > 0
              ? ` (${signer.presentCount}/${signer.requiredCount})`
              : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-slate-500">
        Readiness only — no DocuSign envelopes. Does not replace SPV package tracking.
      </p>
    </div>
  );
}
