import type { AutomationRunStatus } from "@/lib/automation/admin-console-types";

const STYLES: Record<AutomationRunStatus, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  partial: "border-amber-200 bg-amber-50 text-amber-900",
  failed: "border-red-200 bg-red-50 text-red-900",
  running: "border-indigo-200 bg-indigo-50 text-indigo-900",
};

export function AutomationStatusBadge({ status }: Readonly<{ status: AutomationRunStatus | string }>) {
  const key = (status in STYLES ? status : "running") as AutomationRunStatus;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STYLES[key]}`}>
      {status}
    </span>
  );
}
