import { Bell, ChevronDown } from "lucide-react";
import { DonutProgress } from "@/components/ui/charts/DonutProgress";
import { SparklineChart } from "@/components/ui/charts/SparklineChart";

const recentActivity = [
  { label: "Pitch deck reviewed", time: "2h ago", status: "Complete" },
  { label: "Financial model uploaded", time: "5h ago", status: "Complete" },
  { label: "Cap table gap flagged", time: "1d ago", status: "Action" },
];

export function MarketingDashboardPreview() {
  const interestSeries = [12, 14, 15, 17, 19, 21, 23];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-[var(--shadow-card)]">
      <div className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] p-3">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <p className="text-xs font-semibold text-[var(--navy)]">Overview</p>
            <button
              type="button"
              className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-600"
            >
              Acme Robotics Inc.
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--gold)]" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] text-[10px] font-semibold text-white">
              AR
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2 flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-3">
            <DonutProgress percent={87} size={56} strokeWidth={5} label="87" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Readiness Score</p>
              <p className="text-lg font-semibold tabular-nums text-[var(--navy)]">87/100</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[92%] rounded-full bg-[var(--navy)]" />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Diligence Completeness: 92%</p>
            </div>
          </div>

          {[
            { label: "Marketplace Status", value: "Approved", tone: "success" as const },
            { label: "Document Gaps", value: "7", tone: "danger" as const },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-slate-200/80 bg-white p-2.5">
              <p className="text-[10px] font-medium text-slate-500">{metric.label}</p>
              <p
                className={`mt-0.5 text-sm font-semibold ${
                  metric.tone === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {metric.value}
              </p>
            </div>
          ))}

          <div className="col-span-2 rounded-lg border border-slate-200/80 bg-white p-2.5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-slate-500">Investor Interest</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--navy)]">23</p>
              </div>
              <SparklineChart values={interestSeries} width={88} height={28} stroke="var(--gold)" />
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-2 rounded-lg border border-slate-200/80 bg-white p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent Activity</p>
          <ul className="mt-2 space-y-2">
            {recentActivity.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-medium text-slate-700">{item.label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-slate-400">{item.time}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      item.status === "Complete"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
