import Link from "next/link";
import { formatPtDate, graceDaysLeft, type PastDueState } from "@/lib/billing/past-due";

/**
 * Shown on every founder screen while a renewal payment has failed. Renders
 * nothing for a healthy subscription.
 */
export function PastDueBanner({ state, endsAt }: Readonly<{ state: PastDueState; endsAt: string | null }>) {
  if (!state || !endsAt) return null;
  const lapsed = state === "lapsed";
  const days = graceDaysLeft(endsAt);
  const message = lapsed
    ? "Your access is paused because your last payment failed. Update your card to turn it back on."
    : `Your last payment failed. Update your card by ${formatPtDate(endsAt)} (${days} day${days === 1 ? "" : "s"} left) to keep your access.`;
  return (
    <div
      role="alert"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        lapsed ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <span>{message}</span>
      <Link
        href="/founder/settings/billing"
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
      >
        Update payment method
      </Link>
    </div>
  );
}
