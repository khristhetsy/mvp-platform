import Link from "next/link";
import { Suspense } from "react";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { PlanComparisonSection } from "@/components/PlanComparisonSection";
import { UpgradeRequestActions } from "@/components/UpgradeRequestActions";
import {
  getBillingLifecycleLabel,
  getBillingLifecycleStatus,
  getBillingStatusMessage,
} from "@/lib/billing/billing-status";
import { getRequestedPlanForProfile } from "@/lib/billing/requested-plan";
import {
  getFeatureLockCopy,
  getUpgradeUrl,
  parseUpgradeFeature,
  parseUpgradePlan,
} from "@/lib/billing/upgrade";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { subscriptionStatusLabel } from "@/lib/subscriptions/access";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

async function UpgradePageContent({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const featureKey = parseUpgradeFeature(readParam(params.feature));
  const highlightPlan = parseUpgradePlan(readParam(params.plan));
  const profile = await getCurrentUserProfile();

  let subscription = null;
  let requestedPlan = null;

  if (profile) {
    subscription =
      (await getSubscriptionForProfile(profile.id)) ??
      (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
    requestedPlan = await getRequestedPlanForProfile(profile.id);
  }

  const lifecycle = subscription ? getBillingLifecycleStatus(subscription, requestedPlan) : null;
  const featureLock = featureKey ? getFeatureLockCopy(featureKey) : null;

  return (
    <>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Upgrade</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            {featureLock ? featureLock.headline : "Upgrade your CapitalOS workspace"}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {featureLock
              ? featureLock.description
              : "Compare founder plans, request an upgrade, or get notified when billing goes live. No payment is collected in this phase."}
          </p>
        </div>

        {subscription && profile?.role === "founder" ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Your account</h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium text-slate-900">Current plan</dt>
                <dd>{PLAN_LABELS[subscription.plan_type]}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Status</dt>
                <dd>{subscriptionStatusLabel(subscription.subscription_status)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Billing lifecycle</dt>
                <dd>{lifecycle ? getBillingLifecycleLabel(lifecycle) : "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Signup selection</dt>
                <dd>{requestedPlan ? PLAN_LABELS[requestedPlan] : "—"}</dd>
              </div>
            </dl>
            {lifecycle ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {getBillingStatusMessage(subscription, lifecycle, requestedPlan)}
              </p>
            ) : null}
            {featureLock ? (
              <p className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                Unlock <strong>{featureLock.featureLabel}</strong> with{" "}
                <strong>{featureLock.unlockingPlanLabel}</strong>.
              </p>
            ) : null}
          </div>
        ) : profile?.role === "investor" ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
            Investor accounts are free with full workspace access.{" "}
            <Link href="/investor/dashboard" className="font-semibold underline">
              Go to investor dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <Link href="/auth/sign-in" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>{" "}
            to see your current plan, or{" "}
            <Link href="/auth/sign-up" className="font-semibold text-indigo-600 hover:text-indigo-500">
              create an account
            </Link>
            .
          </div>
        )}

        {profile ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Request an upgrade</h2>
            <p className="mt-2 text-sm text-slate-600">
              Billing checkout is not live yet. Submit a request and our team will follow up.
            </p>
            <div className="mt-6">
              <UpgradeRequestActions
                requestedPlan={highlightPlan ?? featureLock?.unlockingPlan ?? requestedPlan}
                featureKey={featureKey}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-14">
          <PlanComparisonSection
            currentPlan={subscription?.plan_type ?? null}
            showInvestor={!profile || profile.role !== "founder"}
            founderCtaHref={profile ? getUpgradeUrl(featureKey, highlightPlan) : "/auth/sign-up"}
            founderCtaLabel={profile ? "Select plan" : "Get started"}
          />
        </div>

        {profile?.role === "founder" ? (
          <p className="mt-8 text-center text-sm text-slate-600">
            <Link href="/founder/settings" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Manage billing in settings
            </Link>
            {" · "}
            <Link href="/billing" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Billing overview
            </Link>
          </p>
        ) : null}
      </section>
    </>
  );
}

export default function UpgradePage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />
      <Suspense fallback={<p className="px-6 py-16 text-sm text-slate-500">Loading upgrade options...</p>}>
        <UpgradePageContent searchParams={searchParams} />
      </Suspense>
      <MarketingFooter />
    </main>
  );
}
