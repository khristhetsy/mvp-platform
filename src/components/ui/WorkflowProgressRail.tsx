import type { OperationalStatus } from "@/lib/ui/design-tokens";
import { statusStyles } from "@/lib/ui/design-tokens";

export type WorkflowStep = {
  key: string;
  label: string;
  complete?: boolean;
  current?: boolean;
  status?: OperationalStatus;
  detail?: string;
};

export function WorkflowProgressRail({
  steps,
  compact = false,
}: Readonly<{ steps: WorkflowStep[]; compact?: boolean }>) {
  if (steps.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"} role="list" aria-label="Workflow progress">
      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const status: OperationalStatus = step.current
            ? "info"
            : step.complete
              ? "success"
              : (step.status ?? "neutral");
          const rail = statusStyles[status].rail;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex min-w-[4.5rem] flex-1 flex-col items-center" role="listitem" aria-current={step.current ? "step" : undefined}>
              <div className="flex w-full items-center">
                <span
                  className={`flex h-2 w-2 shrink-0 rounded-full ${step.complete || step.current ? rail : "bg-slate-200"}`}
                  aria-hidden
                />
                {!isLast ? (
                  <span
                    className={`mx-0.5 h-0.5 flex-1 ${step.complete ? "bg-emerald-400" : "bg-slate-200"}`}
                    aria-hidden
                  />
                ) : null}
              </div>
              <p
                className={`mt-2 max-w-[7rem] text-center text-[10px] leading-tight ${
                  step.current
                    ? "font-semibold text-slate-900"
                    : step.complete
                      ? "text-slate-500"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
      {!compact ? (
        <ul className="space-y-1 border-t border-slate-100 pt-2">
          {steps
            .filter((s) => s.current || s.detail)
            .map((step) => (
              <li key={`detail-${step.key}`} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{step.label}</span>
                {step.detail ? ` — ${step.detail}` : step.current ? " (in progress)" : null}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
