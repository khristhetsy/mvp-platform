import { useTranslations } from "next-intl";
import type { AutomationTimelineItem } from "@/lib/automation/admin-console-types";

export function AutomationExecutionTimeline({ items }: Readonly<{ items: AutomationTimelineItem[] }>) {
  const t = useTranslations("adminCmp");
  if (!items.length) {
    return <p className="text-xs text-slate-600">{t("no_recent_automation_operational_events")}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 border-l-2 border-indigo-200 pl-3 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{item.title}</p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{item.eventType}</p>
          </div>
          <time className="shrink-0 text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}
