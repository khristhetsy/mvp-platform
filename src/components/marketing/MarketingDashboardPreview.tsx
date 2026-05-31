import { SparklineChart } from "@/components/ui/charts/SparklineChart";
import { DonutProgress } from "@/components/ui/charts/DonutProgress";

export function MarketingDashboardPreview() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <div className="rounded-xl border border-slate-100 bg-[var(--surface-sunken)] p-3">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Founder workspace</p>
            <p className="text-[10px] text-slate-500">Live readiness snapshot</p>
          </div>
          <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
            Preview
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: "Readiness", value: "82", spark: [62, 68, 71, 76, 79, 82] },
            { label: "Documents", value: "94%", spark: [70, 75, 80, 85, 90, 94] },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-slate-200/80 bg-white p-2.5">
              <p className="text-[10px] font-medium text-slate-500">{metric.label}</p>
              <div className="mt-1 flex items-end justify-between gap-1">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{metric.value}</p>
                <SparklineChart values={metric.spark} width={56} height={22} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-2.5">
          <DonutProgress percent={76} size={48} strokeWidth={5} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-slate-500">Diligence completeness</p>
            <p className="text-xs font-semibold text-slate-900">3 items remaining</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-3/4 rounded-full bg-indigo-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
