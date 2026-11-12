import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConfirmingPayment } from "@/components/billing/ConfirmingPayment";
import { CreateLoginForm } from "@/components/marketing-site/CreateLoginForm";
import { getPaidSignup } from "@/lib/billing/paid-signup";
import { PAID_SIGNUP_COOKIE, claimWindowOpen, verifyPaidSignupToken } from "@/lib/billing/paid-signup-core";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { getCurrentUserProfile } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Create your login | iCapOS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="bg-gradient-to-b from-site-navy to-site-navy-2 px-6 pb-20 pt-20 text-white">
      <div className="mx-auto max-w-xl">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-white/60" aria-label="Progress">
          <li className="text-emerald-300">✓ Your details</li>
          <li aria-hidden="true">›</li>
          <li className="text-emerald-300">✓ Payment</li>
          <li aria-hidden="true">›</li>
          <li className="font-semibold text-white">Create your login</li>
          <li aria-hidden="true">›</li>
          <li>Onboarding</li>
        </ol>
        <div className="mt-4 rounded-2xl bg-white p-7 text-site-ink shadow-xl">{children}</div>
      </div>
    </section>
  );
}

/** Where a founder lands after paying: set a password, and the already paid plan opens onboarding. */
export default async function StartPaidPage({ searchParams }: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const fromLink = Array.isArray(params.t) ? params.t[0] : params.t;
  const token = fromLink ?? (await cookies()).get(PAID_SIGNUP_COOKIE)?.value ?? null;
  const id = verifyPaidSignupToken(token);
  const row = id ? await getPaidSignup(id) : null;

  // Someone already signed in who comes back from a normal checkout: send them on to billing, which waits for the payment.
  if (!row && (await getCurrentUserProfile())) redirect("/billing?checkout=success");

  if (!row) {
    return (
      <Shell>
        <h1 className="font-site-display text-2xl font-bold text-site-navy">Open your payment link</h1>
        <p className="mt-3 text-sm leading-6 text-site-muted">
          Use the private link in your payment email to create your login. If you already created it, sign in.
        </p>
        <Link href="/auth/sign-in" className="mt-5 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white hover:bg-site-blue-hi">Sign in</Link>
      </Shell>
    );
  }

  if (row.status === "claimed") {
    return (
      <Shell>
        <h1 className="font-site-display text-2xl font-bold text-site-navy">Your login is ready</h1>
        <p className="mt-3 text-sm leading-6 text-site-muted">You already created your login. Sign in to open your workspace.</p>
        <Link href="/auth/sign-in" className="mt-5 inline-block rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white hover:bg-site-blue-hi">Sign in</Link>
      </Shell>
    );
  }

  if (row.status === "checkout_started") {
    return (
      <Shell>
        <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Step 3 of 4</p>
        <h1 className="mb-4 mt-2 font-site-display text-2xl font-bold text-site-navy">Confirming your payment</h1>
        <ConfirmingPayment next="Your login form opens automatically as soon as it is confirmed." />
        <p className="text-[13px] leading-5 text-site-muted">If you have not paid yet, <Link href="/start" className="underline">go back to choose your plan</Link>.</p>
      </Shell>
    );
  }

  if (!claimWindowOpen(row.paid_at)) {
    return (
      <Shell>
        <h1 className="font-site-display text-2xl font-bold text-site-navy">This link has expired</h1>
        <p className="mt-3 text-sm leading-6 text-site-muted">Your payment is safe. Please contact us and we will finish your setup.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Step 3 of 4</p>
      <h1 className="mt-2 font-site-display text-2xl font-bold text-site-navy">Payment received. Create your login.</h1>
      <div className="my-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" role="status">
        <p className="font-semibold">✓ Your {PLAN_LABELS[row.plan_type]} plan is paid.</p>
        <p>A receipt was sent to {row.email}. Set a password to open your workspace.</p>
      </div>
      <CreateLoginForm token={token} email={row.email} />
    </Shell>
  );
}
