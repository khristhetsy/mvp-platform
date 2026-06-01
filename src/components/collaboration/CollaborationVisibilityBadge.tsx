import { visibilityLabel } from "@/lib/collaboration/visibility";
import type { CollaborationVisibility } from "@/lib/collaboration/types";

const STYLES: Record<CollaborationVisibility, string> = {
  admin_only: "border-violet-200 bg-violet-50 text-violet-900",
  internal: "border-slate-300 bg-slate-100 text-slate-800",
  company_team: "border-indigo-200 bg-indigo-50 text-indigo-900",
  investor_related: "border-teal-200 bg-teal-50 text-teal-900",
};

export function CollaborationVisibilityBadge({
  visibility,
  isInternalNote,
}: Readonly<{ visibility: CollaborationVisibility; isInternalNote?: boolean }>) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STYLES[visibility]}`}
      >
        {visibilityLabel(visibility)}
      </span>
      {isInternalNote ? (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
          Internal
        </span>
      ) : null}
    </span>
  );
}
