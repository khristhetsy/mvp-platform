import type { DataRoomActivityItem } from "@/lib/data-room/activity";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Founder-facing feed of investor document views, read from the audit trail.
 * Server component — pass items from listDataRoomActivity().
 */
export function DataRoomActivityPanel({ items }: { items: DataRoomActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <h2 className="text-base font-semibold text-slate-950">Recent activity</h2>
      <p className="mt-1 text-sm text-slate-600">Which investors opened your documents, and when.</p>
      <div className="mt-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No investor views yet. Activity appears here once an investor opens a document.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="font-medium text-slate-900">{item.viewerName}</span> viewed {item.documentLabel}
                </span>
                <span className="flex-none text-xs text-slate-400">{timeAgo(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
