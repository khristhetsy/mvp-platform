import Link from "next/link";
import {
  FEATURE_COMPARISON,
  FOUNDER_PRICING_PLANS,
  INVESTOR_PRICING_PLAN,
  type PricingPlanCard,
} from "@/lib/billing/pricing";
import type { PlanType } from "@/lib/subscriptions/plans";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";

function PlanCard({
  plan,
  currentPlan,
  highlight,
  ctaHref,
  ctaLabel,
}: Readonly<{
  plan: PricingPlanCard;
  currentPlan?: PlanType | null;
  highlight?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}>) {
  const isCurrent = currentPlan === plan.planType;

  return (
    <article
      className={`relative flex flex-col rounded-3xl border p-6 shadow-sm ${
        highlight || plan.recommended
          ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/20"
          : "border-slate-200 bg-white"
      }`}
    >
      {plan.badge ? (
        <span className="absolute right-4 top-4 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {plan.badge}
        </span>
      ) : null}
      <h3 className="text-lg font-semibold text-slate-950">{plan.title}</h3>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {plan.priceLabel}
        {plan.priceSubtext ? <span className="text-base font-normal text-slate-500">{plan.priceSubtext}</span> : null}
      </p>
      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            {feature}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <p className="mt-6 rounded-full bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-700">
          Current plan
        </p>
      ) : ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className={`mt-6 inline-flex justify-center rounded-full px-5 py-3 text-sm font-semibold ${
            highlight || plan.recommended
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500"
              : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          {ctaLabel}
        </Link>
      ) : null}
    </article>
  );
}

export function PlanComparisonSection({
  currentPlan,
  showInvestor = true,
  showComparisonTable = true,
  founderCtaHref = "/auth/sign-up",
  founderCtaLabel = "Get started",
}: Readonly<{
  currentPlan?: PlanType | null;
  showInvestor?: boolean;
  showComparisonTable?: boolean;
  founderCtaHref?: string;
  founderCtaLabel?: string;
}>) {
  return (
    <div className="space-y-12">
      <section>
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder plans</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Choose the right founder workspace</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {FOUNDER_PRICING_PLANS.map((plan) => (
            <PlanCard
              key={plan.planType}
              plan={plan}
              currentPlan={currentPlan}
              highlight={plan.recommended}
              ctaHref={currentPlan ? `/upgrade?plan=${plan.planType}` : founderCtaHref}
              ctaLabel={currentPlan ? "View upgrade options" : founderCtaLabel}
            />
          ))}
        </div>
      </section>

      {showInvestor ? (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Investors</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">{INVESTOR_PRICING_PLAN.title}</h3>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{INVESTOR_PRICING_PLAN.priceLabel}</p>
              <ul className="mt-4 space-y-2">
                {INVESTOR_PRICING_PLAN.features.map((feature) => (
                  <li key={feature} className="text-sm text-slate-600">
                    • {feature}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/auth/sign-up"
              className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-white/80"
            >
              Create investor account
            </Link>
          </div>
        </section>
      ) : null}

      {showComparisonTable ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-950">Feature comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Feature</th>
                  <th className="px-6 py-3 font-medium">Free Trial</th>
                  <th className="px-6 py-3 font-medium">Basic</th>
                  <th className="px-6 py-3 font-medium">Professional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FEATURE_COMPARISON.map((row) => (
                  <tr key={row.featureKey}>
                    <td className="px-6 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-6 py-3 text-slate-600">{row.trial ? "✓" : "—"}</td>
                    <td className="px-6 py-3 text-slate-600">{row.basic ? "✓" : "—"}</td>
                    <td className="px-6 py-3 text-slate-600">{row.professional ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            Trial includes full Professional access for 3 days. After trial, premium features require{" "}
            {PLAN_LABELS.founder_professional}.
          </p>
        </section>
      ) : null}
    </div>
  );
}
