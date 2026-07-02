import { useTranslations } from "next-intl";
import Link from "next/link";
import type { AutomationDependencyInsight } from "@/lib/automation/admin-console-types";

export function AutomationDependencyPanel({
  topBlockers,
  blockedWorkflows,
}: Readonly<{ topBlockers: AutomationDependencyInsight[]; blockedWorkflows: number }>) {
  const t = useTranslations("adminCmp");
  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/30 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t("dependencies")}</p>
      <p className="mt-1 text-xs text-amber-950">{blockedWorkflows} blocked workflow action(s) platform-wide.</p>
      {topBlockers.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {topBlockers.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-800">{item.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-amber-900">×{item.count}</span>
                {item.href ? (
                  <Link href={item.href} className="font-semibold text-indigo-700 hover:underline">
                    Open
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-600">{t("no_recent_dependency_detection_events")}</p>
      )}
    </div>
  );
}
