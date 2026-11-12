import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestPayPanel } from "@/components/marketing-site/GuestPayPanel";
import { isGuestCheckoutPlan } from "@/lib/billing/paid-signup-core";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { priceShort } from "@/lib/subscriptions/pricing-catalog";
import { loadPricing } from "@/lib/subscriptions/pricing-server";

export const metadata: Metadata = { title: "Pay to start your plan | iCapOS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Payment comes first for Basic and Professional: this page, then secure checkout, then the login. */
export default async function StartPayPage({ searchParams }: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const email = one(params.email).trim();
  const plan = one(params.plan);
  if (!email.includes("@") || !isGuestCheckoutPlan(plan)) redirect("/start");

  const pricing = await loadPricing();
  const price = priceShort(pricing, plan);

  return (
    <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-20 pt-20 text-white">
      <div className="mx-auto max-w-xl">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-white/60" aria-label="Progress">
          <li className="text-emerald-300">✓ Your details</li>
          <li aria-hidden="true">›</li>
          <li className="font-semibold text-white">Payment</li>
          <li aria-hidden="true">›</li>
          <li>Create your login</li>
          <li aria-hidden="true">›</li>
          <li>Onboarding</li>
        </ol>
        <div className="mt-4 rounded-2xl bg-white p-7 text-site-ink shadow-xl">
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Step 2 of 4</p>
          <h1 className="mt-2 font-site-display text-2xl font-bold text-site-navy">Pay to start your plan</h1>
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">
            <p className="font-semibold">Payment comes first.</p>
            <p>After you pay, you create your login and begin onboarding.</p>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-site-blue-hi bg-site-blue-pale/40 px-5 py-4">
            <div>
              <p className="text-base font-semibold text-site-navy">{PLAN_LABELS[plan]}</p>
              <p className="text-[12px] text-site-muted">Billed monthly, by card. For {email}</p>
            </div>
            <p className="font-site-display text-xl font-extrabold text-site-navy">{price}</p>
          </div>
          <div className="mt-5">
            <GuestPayPanel email={email} plan={plan} name={one(params.name) || null} company={one(params.company) || null} price={price} />
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-white/70">
          Wrong plan? <Link href="/start" className="underline">Go back</Link>
        </p>
      </div>
    </section>
  );
}
