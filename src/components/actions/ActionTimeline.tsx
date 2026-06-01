import type { ActionTimelineItem } from "@/lib/actions/types";

export function ActionTimeline({ items }: Readonly<{ items: ActionTimelineItem[] }>) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">No related operational events yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--navy)]">{item.title}</p>
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
