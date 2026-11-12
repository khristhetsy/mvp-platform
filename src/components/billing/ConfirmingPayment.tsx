"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-checks the payment every few seconds while the payment provider confirms it. */
export function ConfirmingPayment() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" role="status">
      <span aria-hidden="true">✓</span>
      <div>
        <p className="font-semibold">Thank you. We are confirming your payment.</p>
        <p>This takes a few seconds. Onboarding opens automatically as soon as it is confirmed.</p>
      </div>
    </div>
  );
}
