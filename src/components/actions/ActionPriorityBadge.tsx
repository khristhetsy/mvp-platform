import { formatPriorityLabel, priorityBadgeClass } from "@/lib/next-best-actions/display";
import type { NextBestActionPriority } from "@/lib/next-best-actions/types";

export function ActionPriorityBadge({ priority }: Readonly<{ priority: NextBestActionPriority }>) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClass(priority)}`}
    >
      {formatPriorityLabel(priority)}
    </span>
  );
}
