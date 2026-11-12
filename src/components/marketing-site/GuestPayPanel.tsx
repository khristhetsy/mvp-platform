"use client";

import Link from "next/link";
import { useState } from "react";
import { REFUND_POLICY_VERSION } from "@/components/billing/CheckoutButton";

/** Payment step of /start for Basic and Professional: terms, then Lemon Squeezy. No login exists yet. */
export function GuestPayPanel({
  email,
  plan,
  name,
  company,
  price,
}: Readonly<{ email: string; plan: "founder_basic" | "founder_professional"; name: string | null; company: string | null; price: string }>) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);

  async function pay() {
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          planType: plan,
          name: name ?? undefined,
          company: company ?? undefined,
          refundPolicyAcceptedAt: new Date().toISOString(),
          refundPolicyVersion: REFUND_POLICY_VERSION,
        }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string; code?: string } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setAccountExists(data?.code === "account_exists");
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <label className="flex gap-2.5 text-[13px] leading-5 text-site-ink">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>I accept the billing terms. Fees are non refundable once services begin.</span>
      </label>
      {error ? (
        <p className="mt-3 text-[13px] text-red-600" role="alert">
          {error}{" "}
          {accountExists ? <Link href="/auth/sign-in" className="font-medium underline">Sign in</Link> : null}
        </p>
      ) : null}
      <button
        type="button"
        onClick={pay}
        disabled={!consent || busy}
        className="mt-5 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Opening secure checkout…" : `Pay ${price} and continue`}
      </button>
      <p className="mt-3 text-center text-[12px] leading-5 text-site-muted">
        Secure checkout by Lemon Squeezy. After you pay, you create your login and start onboarding.
      </p>
    </div>
  );
}
