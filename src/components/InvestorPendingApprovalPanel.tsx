import Link from "next/link";
import type { InvestorApprovalStatus } from "@/lib/investor/types";
import { investorApprovalStatusLabel } from "@/lib/investor/access";

export function InvestorPendingApprovalPanel({
  approvalStatus,
  adminFeedback,
}: Readonly<{
  approvalStatus: InvestorApprovalStatus | string;
  adminFeedback?: string | null;
}>) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Investor approval required</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {investorApprovalStatusLabel(approvalStatus)}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-950/90">
        This action is available after CapitalOS admin review. You can use your dashboard and complete onboarding while
        your profile is reviewed. Expressing interest, intro requests, pledges, and watchlist actions unlock after
        approval.
      </p>
      {adminFeedback ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Admin feedback:</span> {adminFeedback}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/investor/onboarding"
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue onboarding
        </Link>
        <Link
          href="/investor/dashboard"
          className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-950"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
