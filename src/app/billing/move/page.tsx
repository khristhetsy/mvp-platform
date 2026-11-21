import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyMoveLinkToken } from "@/lib/billing/move-link-core";
import { describeMove, type AdminCheckoutInput } from "@/lib/billing/admin-checkout";
import { isStripePlan } from "@/lib/billing/stripe-mapping";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { MoveToStripeButton } from "@/components/billing/MoveToStripeButton";

export const metadata: Metadata = { title: "Move your billing to Stripe | iCapOS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Notice({ title, text }: Readonly<{ title?: string; text: string }>) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </main>
  );
}

/** The page behind the "Add my card" email: shows the move, then makes a fresh Stripe checkout on click. */
export default async function MoveToStripePage({ searchParams }: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const token = one((await searchParams)?.t);
  const profileId = verifyMoveLinkToken(token);
  if (!profileId) return <Notice text="This link is not valid. Please ask iCFO for a new one." />;

  const admin = createServiceRoleClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await admin
    .from("subscriptions")
    .select("plan_type, subscription_status, ls_subscription_id, ls_variant_id, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, grace_period_ends_at, current_period_end")
    .eq("profile_id", profileId)
    .maybeSingle();
  const sub = (data ?? null) as AdminCheckoutInput["subscription"];
  if (sub?.stripe_subscription_id) {
    return <Notice title="You're all set" text="Your card is on file at Stripe, so there is nothing more to do. Your plan continues at the same price." />;
  }
  const plan = sub?.plan_type;
  if (!sub || !isStripePlan(plan) || !describeMove(sub, plan).moving) {
    return <Notice text="This link is no longer active. Please ask iCFO for a new one." />;
  }
  const ends = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Billing</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Move your billing to Stripe</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your {PLAN_LABELS[plan] ?? plan} plan stays at the same price. Nothing is charged today.
          {ends ? ` Your first Stripe payment is when your current period ends, on ${ends}.` : ""}
        </p>
        <div className="mt-6">
          <MoveToStripeButton token={token} />
        </div>
        <p className="mt-4 text-xs text-slate-500">You enter your card on Stripe. iCapOS never sees it.</p>
      </div>
    </main>
  );
}
