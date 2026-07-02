import { useTranslations } from "next-intl";
import type { SanitizedAutomationRunMetadata } from "@/lib/automation/admin-console-types";

export function AutomationFailurePanel({ metadata }: Readonly<{ metadata: SanitizedAutomationRunMetadata }>) {
  const t = useTranslations("adminCmp");
  const failedRules = (metadata.results ?? []).filter((r) => r.status === "failed");
  const errors = metadata.errors ?? [];

  if (!failedRules.length && !errors.length) return null;

  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-900">{t("failures")}</p>
      <ul className="mt-2 space-y-1 text-xs text-red-950">
        {errors.map((err) => (
          <li key={`${err.step}-${err.message}`}>
            <span className="font-mono">{err.step}</span>: {err.message}
          </li>
        ))}
        {failedRules.map((rule) => (
          <li key={rule.ruleId}>
            Rule <span className="font-mono">{rule.ruleId}</span>: {rule.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
