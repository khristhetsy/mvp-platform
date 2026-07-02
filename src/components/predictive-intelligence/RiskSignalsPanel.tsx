import type { RiskSignal } from "@/lib/predictive-intelligence/types";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRiskScore, riskSeverityBadgeStatus } from "@/lib/predictive-intelligence/display";

export function RiskSignalsPanel({
  title = "Predictive risk signals (Phase 1)",
  subtitle = "Deterministic rules — no workflow state changes",
  signals,
  maxItems = 3,
}: Readonly<{
  title?: string;
  subtitle?: string;
  signals: RiskSignal[];
  maxItems?: number;
}>) {
  const t = useTranslations("sharedCmp");
  const rows = (signals ?? []).slice(0, maxItems);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t("no_risk_signals_available")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={s.severity} status={riskSeverityBadgeStatus(s.severity)} />
                  <span className="font-semibold text-slate-900">{s.title}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{formatRiskScore(s.score)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.explanation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded bg-white px-2 py-0.5">confidence: {s.confidence}</span>
                <a href={s.href} className="font-semibold text-indigo-700 hover:underline">
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-500">
        Privacy: no documents, file paths, message bodies, tokens, or legal notes shown.
      </p>
    </div>
  );
}

