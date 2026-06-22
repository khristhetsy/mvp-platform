// Small presentational primitives for admin tasks. Brand: navy #0F2147,
// teal #0D9488, mint #5EEAD4, plus per-status / per-priority colors.

import type { TaskPriority, TaskStatus } from "@/lib/admin-tasks/types";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/admin-tasks/types";

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-[#CCFBF1] text-[#0F766E]",
  review: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_STYLE: Record<TaskPriority, { dot: string; text: string }> = {
  high: { dot: "bg-red-500", text: "text-red-700" },
  medium: { dot: "bg-amber-500", text: "text-amber-700" },
  low: { dot: "bg-slate-400", text: "text-slate-500" },
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityDot({ priority, withLabel = false }: { priority: TaskPriority; withLabel?: boolean }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden /> {withLabel ? PRIORITY_LABELS[priority] : null}
    </span>
  );
}

function initials(label: string): string {
  return label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export function OwnerAvatar({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F2147] text-[10px] font-semibold text-[#5EEAD4]">{initials(label)}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </span>
  );
}

export function TagChip({ tag }: { tag: string }) {
  return <span className="inline-flex items-center rounded-md bg-[#CCFBF1] px-2 py-0.5 text-[11px] font-medium text-[#0F766E]">{tag}</span>;
}

export function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = d.getTime() < today.getTime();
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), overdue };
}
