"use client";

import Link from "next/link";
import { useState } from "react";
import { REFUND_POLICY_VERSION } from "@/components/billing/CheckoutButton";
import { AGREEMENT_TERMS } from "@/lib/billing/premium-agreement-core";

function Field({ id, label, value, onChange, multiline, type }: Readonly<{ id: string; label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string }>) {
  const cls = "w-full rounded-lg border border-site-line bg-white px-3 py-2 text-sm text-site-ink";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] text-site-muted">{label}</label>
      {multiline ? (
        <textarea id={id} rows={3} value={value} maxLength={400} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input id={id} type={type ?? "text"} value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

/** Payment step of /start for Basic, Professional and Premium: terms, then secure checkout. No login exists yet. Premium also collects the Services Agreement here. */
export function GuestPayPanel({
  email,
  plan,
  name,
  company,
  price,
}: Readonly<{ email: string; plan: "founder_basic" | "founder_professional" | "founder_premium"; name: string | null; company: string | null; price: string }>) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const isPremium = plan === "founder_premium";
  const [agree, setAgree] = useState(false);
  const [agr, setAgr] = useState({ companyName: company ?? "", companyAddress: "", companyEmail: email, acceptedName: name ?? "", acceptedTitle: "" });
  const agrComplete = Object.values(agr).every((v) => v.trim().length > 0);
  const [reviewing, setReviewing] = useState(false);
  const ready = consent && (!isPremium || (agrComplete && agree));

  async function reviewAgreement() {
    if (!agrComplete || reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/guest-agreement-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agr) });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "We could not prepare the agreement.");
      }
      const url = URL.createObjectURL(await res.blob());
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not prepare the agreement.");
    }
    setReviewing(false);
  }

  async function pay() {
    if (!ready || busy) return;
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
          ...(isPremium ? { agreement: agr, agree } : {}),
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
      {isPremium ? (
        <div className="mb-5 space-y-3">
          <p className="text-[13px] leading-5 text-site-muted">Premium includes a Services Agreement with iCFO. Check the details, review it, then accept it before you pay. Notices go to {email}.</p>
          <div className="overflow-hidden rounded-lg border border-site-line">
            {AGREEMENT_TERMS.map((t, i) => (
              <div key={t.label} className={`flex justify-between gap-3 px-3 py-2 text-[13px] ${i ? "border-t border-site-line" : ""}`}>
                <span className="text-site-muted">{t.label}</span>
                <span className="text-right text-site-ink">{t.value}</span>
              </div>
            ))}
          </div>
          <Field id="agr-company" label="Company legal name" value={agr.companyName} onChange={(v) => setAgr({ ...agr, companyName: v })} />
          <Field id="agr-address" label="Company address" value={agr.companyAddress} onChange={(v) => setAgr({ ...agr, companyAddress: v })} multiline />
          <Field id="agr-name" label="Your name" value={agr.acceptedName} onChange={(v) => setAgr({ ...agr, acceptedName: v })} />
          <Field id="agr-title" label="Your title" value={agr.acceptedTitle} onChange={(v) => setAgr({ ...agr, acceptedTitle: v })} />
          <button type="button" onClick={reviewAgreement} disabled={!agrComplete || reviewing} className="text-[13px] font-medium text-site-blue underline disabled:cursor-not-allowed disabled:opacity-50">
            {reviewing ? "Preparing the agreement…" : "Review the agreement"}
          </button>
          <label className="flex gap-2.5 text-[13px] leading-5 text-site-ink">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>I am authorized to accept this agreement for <strong>{agr.companyName || "my company"}</strong> and I agree to the Services Agreement.</span>
          </label>
        </div>
      ) : null}
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
        disabled={!ready || busy}
        className="mt-5 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Opening secure checkout…" : `Pay ${price} and continue`}
      </button>
      <p className="mt-3 text-center text-[12px] leading-5 text-site-muted">
        Secure checkout by Stripe.{isPremium ? " No sales tax line for Premium." : ""} After you pay, you create your login and start onboarding.
      </p>
    </div>
  );
}
