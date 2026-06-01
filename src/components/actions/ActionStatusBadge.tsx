import { formatStatusLabel, statusBadgeClass } from "@/lib/next-best-actions/display";
import type { NextBestActionLifecycleStatus } from "@/lib/next-best-actions/types";

export function ActionStatusBadge({ status }: Readonly<{ status?: NextBestActionLifecycleStatus }>) {
  const isOverdueCritical = status === "overdue";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(status)} ${
        isOverdueCritical ? "ring-1 ring-red-200" : ""
      }`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
