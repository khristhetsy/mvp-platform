import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingOwnerOnlyCard } from "@/components/billing/BillingOwnerOnlyCard";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ConfirmingPayment } from "@/components/billing/ConfirmingPayment";
import { canManageBilling } from "@/lib/billing/billing-access";
import { mustPayFirst } from "@/lib/billing/payment-gate-server";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { priceShort } from "@/lib/subscriptions/pricing-catalog";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Complete your payment | iCapOS" };

/**
 * First payment, straight after sign up. A founder who picked a paid plan is
 * held here until the payment is confirmed; the founder pages send them back
 * here until then. Once the plan is active this page sends them to onboarding.
 */
export default async function PaymentRequiredPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const profile = await requireRole(["founder"]);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));

  if (!(await mustPayFirst(subscription, profile.id))) {
    redirect("/founder/onboarding");
  }

  const params = (await searchParams) ?? {};
  const confirming = params.checkout === "success";
  const pricing = await loadPricing();
  const planLabel = PLAN_LABELS[subscription.plan_type];
  const price = priceShort(pricing, subscription.plan_type);
  const isOwner = await canManageBilling(profile.id);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">C</span>
          <span className="text-lg font-semibold tracking-tight text-white">iCapOS</span>
        </Link>

        <ol className="mt-8 flex flex-wrap items-center gap-2 text-xs text-slate-400" aria-label="Progress">
          <li className="text-emerald-400">✓ Account created</li>
          <li aria-hidden="true">›</li>
          <li className="font-semibold text-white">Payment</li>
          <li aria-hidden="true">›</li>
          <li>Onboarding</li>
        </ol>

        <div className="mt-4 rounded-2xl bg-white p-7 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Step 2 of 3</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Complete your payment to continue</h1>

          {confirming ? (
            <div className="mt-5"><ConfirmingPayment /></div>
          ) : (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">
              <p className="font-semibold">Payment is required before onboarding.</p>
              <p>Your account is created. Pay for your plan to begin onboarding. You cannot go forward until payment is received.</p>
            </div>
          )}

          {isOwner ? (
            <>
              <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-indigo-500 bg-indigo-50 px-5 py-4">
                <p className="text-base font-semibold text-slate-950">{planLabel}</p>
                <p className="text-xl font-bold text-slate-950">{price}</p>
              </div>
              <div className="mt-5">
                <CheckoutButton planType={subscription.plan_type} label={`Pay ${price} and continue`} recommended pricing={pricing} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Secure checkout by Lemon Squeezy. You return here after paying, and onboarding opens as soon as the payment is confirmed.</p>
            </>
          ) : (
            <div className="mt-5"><BillingOwnerOnlyCard /></div>
          )}

          <div className="mt-6 flex items-center gap-3 border-t border-dashed border-slate-200 pt-4 text-sm text-slate-500">
            <span aria-hidden="true">🔒</span>
            <p>Onboarding and your workspace stay locked until your payment is confirmed by our payment system.</p>
          </div>
        </div>

        <form action="/auth/logout" method="post" className="mt-5 text-center">
          <button type="submit" className="text-sm text-slate-400 underline hover:text-white">Sign out</button>
        </form>
      </div>
    </div>
  );
}
