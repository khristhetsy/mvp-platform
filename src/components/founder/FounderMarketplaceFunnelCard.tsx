import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FounderAnalyticsSnapshot } from "@/lib/analytics/founder-analytics";

type FunnelStep = {
  label: string;
  count: number;
  href?: string;
  description: string;
  color: string;
  dot: string;
};

function convRate(from: number, to: number): string | null {
  if (from === 0) return null;
  return `${Math.round((to / from) * 100)}%`;
}

export function FounderMarketplaceFunnelCard({
  analytics,
}: {
  analytics: Pick<
    FounderAnalyticsSnapshot,
    | "reportViewCount"
    | "savedByInvestorsCount"
    | "investorInterestCount"
    | "introRequestCount"
  >;
}) {
  const t = useTranslations("founderCmp");
  const steps: FunnelStep[] = [
    {
      label: "Report views",
      count: analytics.reportViewCount,
      href: "/founder/capital-raise",
      description: "Investors who opened your diligence report",
      color: "bg-slate-100 text-slate-700",
      dot: "bg-slate-400",
    },
    {
      label: "Saves",
      count: analytics.savedByInvestorsCount,
      href: "/founder/capital-raise",
      description: "Investors who added you to their watchlist",
      color: "bg-indigo-50 text-indigo-800",
      dot: "bg-indigo-400",
    },
    {
      label: "Interests expressed",
      count: analytics.investorInterestCount,
      href: "/founder/capital-raise",
      description: "Investors who formally expressed interest",
      color: "bg-violet-50 text-violet-800",
      dot: "bg-violet-500",
    },
    {
      label: "Intro requests",
      count: analytics.introRequestCount,
      href: "/founder/capital-raise",
      description: "Investors who requested a direct introduction",
      color: "bg-emerald-50 text-emerald-800",
      dot: "bg-emerald-500",
    },
  ];

  const maxCount = Math.max(1, ...steps.map((s) => s.count));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("marketplace_funnel")}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          How investors move from discovering your profile to requesting an introduction
        </p>
      </div>

      <div className="space-y-1 p-5">
        {steps.map((step, i) => {
          const prevStep = i > 0 ? steps[i - 1] : null;
          const rate = prevStep ? convRate(prevStep.count, step.count) : null;
          const barPct = Math.round((step.count / maxCount) * 100);

          return (
            <div key={step.label}>
              {/* Conversion arrow between steps */}
              {rate && (
                <div className="flex items-center gap-2 py-1 pl-2">
                  <span className="text-[10px] text-slate-400">↓</span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {rate} conversion
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${step.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${step.color}`}>
                        {step.count}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">{step.description}</p>
                    {/* Bar */}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${step.dot}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <Link
          href="/founder/capital-raise"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View full capital raise dashboard →
        </Link>
      </div>
    </div>
  );
}
