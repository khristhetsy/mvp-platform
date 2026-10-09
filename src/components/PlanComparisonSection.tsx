import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  INVESTOR_PRICING_PLAN,
  featureComparison,
  founderPricingPlans,
  type PricingPlanCard,
} from "@/lib/billing/pricing";
import { CODE_DEFAULT_PRICING, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";
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

/** Where each card's button goes. Free has no button for a founder already on a plan. */
function planCta(
  plan: PricingPlanCard,
  currentPlan: PlanType | null,
  founderCtaHref: string,
  founderCtaLabel: string,
): { href: string; label: string } | null {
  if (plan.contactSales) return { href: `/auth/sign-up?plan=${plan.planType}`, label: "Talk to us" };
  if (plan.planType === "founder_free") {
    return currentPlan ? null : { href: "/auth/sign-up?role=founder&plan=founder_free", label: "Get my free report" };
  }
  if (plan.planType === "founder_premium") {
    return currentPlan
      ? { href: "/billing?plan=founder_premium", label: "Request wire invoice" }
      : { href: "/auth/sign-up?role=founder&plan=founder_premium", label: "Start on Premium" };
  }
  return currentPlan ? { href: `/upgrade?plan=${plan.planType}`, label: "View upgrade options" } : { href: founderCtaHref, label: founderCtaLabel };
}

export function PlanComparisonSection({
  currentPlan,
  showInvestor = true,
  showComparisonTable = true,
  founderCtaHref = "/auth/sign-up",
  founderCtaLabel = "Get started",
  pricing = CODE_DEFAULT_PRICING,
}: Readonly<{
  currentPlan?: PlanType | null;
  showInvestor?: boolean;
  showComparisonTable?: boolean;
  founderCtaHref?: string;
  founderCtaLabel?: string;
  /** Active pricing, passed by the server page. Defaults to the code constants. */
  pricing?: PricingCatalog;
}>) {
  // Free and Premium are always listed (Oct 9, 2026). Premium is paid by wire,
  // so a signed in founder goes to the wire panel on /billing, never to checkout.
  const founderPlans = founderPricingPlans(pricing);
  const comparisonRows = featureComparison(pricing);
  const t = useTranslations("sharedCmp");
  return (
    <div className="space-y-12">
      <section>
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("founder_plans")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{t("choose_the_right_founder_workspace")}</h2>
        </div>
        <div className={`grid gap-5 sm:grid-cols-2 ${founderPlans.length > 4 ? "lg:grid-cols-3 xl:grid-cols-5" : founderPlans.length > 3 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
          {founderPlans.map((plan) => {
            const cta = planCta(plan, currentPlan ?? null, founderCtaHref, founderCtaLabel);
            return (
              <PlanCard
                key={plan.planType}
                plan={plan}
                currentPlan={currentPlan}
                highlight={plan.recommended}
                ctaHref={cta?.href}
                ctaLabel={cta?.label}
              />
            );
          })}
        </div>
      </section>

      {showInvestor ? (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t("investors")}</p>
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
            <h3 className="text-lg font-semibold text-slate-950">{t("feature_comparison")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Feature</th>
                  <th className="px-6 py-3 font-medium">Basic</th>
                  <th className="px-6 py-3 font-medium">Professional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-6 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-6 py-3 text-slate-600">{row.basic ? <i className="ti ti-check" aria-hidden="true" /> : "—"}</td>
                    <td className="px-6 py-3 text-slate-600">{row.professional ? <i className="ti ti-check" aria-hidden="true" /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            Basic and Professional include every tool. Professional adds presentation slots and more intro requests.
            Premium is done for you and paid by bank wire. {PLAN_LABELS.founder_managed_ir} is done for you through an SPV.
          </p>
        </section>
      ) : null}
    </div>
  );
}
