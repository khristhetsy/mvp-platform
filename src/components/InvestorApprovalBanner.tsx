import Link from "next/link";
import { investorApprovalStatusLabel, isInvestorApproved } from "@/lib/investor/access";
import type { InvestorProfileRecord } from "@/lib/investor/types";

export function InvestorApprovalBanner({
  investorProfile,
}: Readonly<{ investorProfile: InvestorProfileRecord | null }>) {
  if (!investorProfile) {
    return null;
  }

  const status = investorProfile.approval_status;
  const approved = isInvestorApproved(status);

  if (approved) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-sm font-semibold text-emerald-900">Approved investor account</p>
        <p className="mt-1 text-sm text-emerald-800">
          Your profile is approved. Full investor workspace access is enabled at no cost.
        </p>
      </div>
    );
  }

  const showOnboardingCta = status === "draft" || status === "changes_requested" || status === "rejected";

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 ${
        status === "submitted" ? "border-amber-200 bg-amber-50" : "border-indigo-200 bg-indigo-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Investor account status</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{investorApprovalStatusLabel(status)}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {status === "submitted"
              ? "Your onboarding submission is in the admin review queue. You have limited workspace access until approved."
              : status === "changes_requested"
                ? "Admin requested updates to your investor profile. Revise onboarding and resubmit."
                : status === "rejected"
                  ? "Your submission was not approved. Update your profile and resubmit for review."
                  : "Complete investor onboarding and submit for admin approval to unlock interest, intros, pledges, and watchlist actions."}
          </p>
          {investorProfile.admin_feedback ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">Feedback:</span> {investorProfile.admin_feedback}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            status === "submitted"
              ? "bg-amber-100 text-amber-900"
              : status === "rejected"
                ? "bg-red-100 text-red-800"
                : "bg-indigo-100 text-indigo-900"
          }`}
        >
          {investorApprovalStatusLabel(status)}
        </span>
      </div>
      {showOnboardingCta ? (
        <Link
          href="/investor/onboarding"
          className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue onboarding
        </Link>
      ) : null}
    </div>
  );
}
