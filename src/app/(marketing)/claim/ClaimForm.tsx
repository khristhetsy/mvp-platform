"use client";

import { useState } from "react";
import { claimSignUpUrl, looksLikeEmail } from "./claim-url";

/**
 * The claim step: the email (read only when it came signed in the lead email
 * link, typed when the link was forwarded or broken), the authorization
 * checkbox, and the button to free founder sign up.
 */
export function ClaimForm({
  verifiedEmail,
  claimToken,
  partnerCode,
}: Readonly<{ verifiedEmail: string | null; claimToken: string | null; partnerCode: string | null }>) {
  const [typed, setTyped] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = verifiedEmail ?? typed;

  function claim(e: React.FormEvent) {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter your work email to claim the report.");
      return;
    }
    if (!authorized) {
      setError("Confirm you are authorized to represent this company.");
      return;
    }
    setError(null);
    window.location.href = claimSignUpUrl({
      email,
      claimToken: verifiedEmail ? claimToken : null,
      partnerCode,
    });
  }

  return (
    <form onSubmit={claim} noValidate>
      <label htmlFor="claim-email" className="block text-sm font-semibold text-site-navy">
        Work email
      </label>
      {verifiedEmail ? (
        <input
          id="claim-email"
          type="email"
          value={verifiedEmail}
          readOnly
          aria-readonly="true"
          className="mt-2 w-full rounded-lg border border-site-line bg-site-paper px-3.5 py-2.5 text-sm text-site-ink"
        />
      ) : (
        <input
          id="claim-email"
          type="email"
          autoComplete="email"
          required
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="you@company.com"
          className="mt-2 w-full rounded-lg border border-site-line bg-white px-3.5 py-2.5 text-sm text-site-ink focus:border-site-blue focus:outline-none"
        />
      )}

      <label className="mt-4 flex items-start gap-2.5 text-sm text-site-ink">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1A6CE4]"
        />
        <span>I confirm I&rsquo;m authorized to represent this company</span>
      </label>

      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}

      <button
        type="submit"
        className="mt-5 w-full rounded-lg bg-site-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi"
      >
        Claim my FREE report
      </button>
      <p className="mt-3 text-center text-xs text-site-muted">No payment details asked for the free report.</p>
    </form>
  );
}
