import type { ActionTimelineItem } from "@/lib/actions/types";
import { useTranslations } from "next-intl";

export function ActionTimeline({ items }: Readonly<{ items: ActionTimelineItem[] }>) {
  const t = useTranslations("sharedCmp");
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">{t("no_related_operational_events_yet")}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-950">{item.title}</p>
            <span className="text-[10px] uppercase text-slate-400">{item.severity}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {item.event_type.replaceAll("_", " ")} · {new Date(item.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
