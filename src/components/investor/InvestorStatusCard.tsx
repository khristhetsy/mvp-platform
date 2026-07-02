import Link from "next/link";
import { useTranslations } from "next-intl";

type ApprovalStatus = "draft" | "submitted" | "changes_requested" | "approved" | "rejected" | string;

const STEPS = ["Complete profile", "Submit for review", "Approved — full access"] as const;

function activeStepIndex(status: ApprovalStatus, profileComplete: boolean): number {
  if (status === "approved") return 3;
  if (status === "submitted") return 2;
  if (status === "changes_requested" || status === "rejected") return 1;
  // draft
  return profileComplete ? 1 : 0;
}

/**
 * Investor orientation: where am I in the approval flow, what unlocks when I'm
 * approved, and the single next step. Mirrors the founder StageProgressCard.
 */
export function InvestorStatusCard({
  approvalStatus,
  profileComplete,
}: {
  approvalStatus: ApprovalStatus;
  profileComplete: boolean;
}) {
  const t = useTranslations("investorCmp");
  const stepIdx = activeStepIndex(approvalStatus, profileComplete);
  const approved = approvalStatus === "approved";

  // Resolve the single next step.
  let cta: { href: string; label: string } | null = null;
  let statusNote: { tone: "amber" | "rose"; text: string } | null = null;

  if (approvalStatus === "draft" && !profileComplete) {
    cta = { href: "/investor/onboarding", label: "Complete your profile" };
  } else if (approvalStatus === "draft" && profileComplete) {
    cta = { href: "/investor/onboarding", label: "Submit for review" };
  } else if (approvalStatus === "submitted") {
    statusNote = { tone: "amber", text: "Your profile is under review — our team will approve you shortly." };
  } else if (approvalStatus === "changes_requested") {
    statusNote = { tone: "rose", text: "Changes were requested on your profile." };
    cta = { href: "/investor/onboarding", label: "Address feedback" };
  } else if (approvalStatus === "rejected") {
    statusNote = { tone: "rose", text: "Your application needs attention before it can be approved." };
    cta = { href: "/investor/onboarding", label: "Review your profile" };
  } else if (approved) {
    cta = { href: "/investor/opportunities", label: "Browse opportunities" };
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("your_access")}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {approved ? "You're approved — full marketplace access" : "Get approved to unlock the marketplace"}
          </h2>
          {!approved ? (
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Approval unlocks expressing interest, requesting introductions, joining SPVs, and full company data rooms.
            </p>
          ) : null}
        </div>
        {cta ? (
          <Link href={cta.href} className="inline-flex flex-none items-center rounded-lg bg-[var(--indigo)] px-4 py-2 text-sm font-semibold text-white">
            {cta.label} →
          </Link>
        ) : null}
      </div>

      {/* Step tracker */}
      <ol className="mt-5 grid gap-2 sm:grid-cols-3">
        {STEPS.map((label, i) => {
          const done = i < stepIdx;
          const current = i === stepIdx && !approved;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : current
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${done ? "bg-emerald-500 text-white" : current ? "bg-indigo-500 text-white" : "bg-slate-300 text-white"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ol>

      {statusNote ? (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${statusNote.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {statusNote.text}
        </div>
      ) : null}
    </section>
  );
}
