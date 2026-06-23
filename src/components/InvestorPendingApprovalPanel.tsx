import Link from "next/link";
import type { InvestorApprovalStatus } from "@/lib/investor/types";

type CTA = { href: string; label: string };
type StatusContent = {
  tone: "amber" | "blue" | "red";
  eyebrow: string;
  title: string;
  body: string;
  primary: CTA;
};

const TONES = {
  amber: { border: "border-amber-200", bg: "bg-amber-50", eyebrow: "text-amber-800", body: "text-amber-950/90", btn: "bg-slate-950 hover:bg-slate-800", outline: "border-amber-300 text-amber-950" },
  blue: { border: "border-[#B5D4F4]", bg: "bg-[#E6F1FB]", eyebrow: "text-[#0C447C]", body: "text-[#0C447C]/90", btn: "bg-[#185FA5] hover:bg-[#0C447C]", outline: "border-[#B5D4F4] text-[#0C447C]" },
  red: { border: "border-[#F7C1C1]", bg: "bg-[#FCEBEB]", eyebrow: "text-[#A32D2D]", body: "text-[#A32D2D]/90", btn: "bg-[#A32D2D] hover:bg-[#791F1F]", outline: "border-[#F7C1C1] text-[#A32D2D]" },
} as const;

/** Per-status copy + actions so the message matches where the investor actually is. */
function contentFor(status: InvestorApprovalStatus | string): StatusContent {
  switch (status) {
    case "submitted":
      return {
        tone: "blue",
        eyebrow: "Profile under review",
        title: "We're reviewing your profile",
        body: "Your profile is with the CapitalOS team — we'll email you the moment it's approved (usually within a day or two). In the meantime you can browse live opportunities. Saving deals, expressing interest, and messaging unlock once you're approved.",
        primary: { href: "/investor/opportunities", label: "Browse opportunities" },
      };
    case "rejected":
    case "changes_requested":
      return {
        tone: "red",
        eyebrow: "Changes requested",
        title: "Your profile needs a quick update",
        body: "The CapitalOS team has asked for a few changes before approving your account. Review the note below, update your profile, and resubmit.",
        primary: { href: "/investor/onboarding", label: "Update profile" },
      };
    default: // draft / unknown
      return {
        tone: "amber",
        eyebrow: "Finish your profile",
        title: "Complete your investor profile",
        body: "You're almost there. Finish and submit your profile to unlock the full investor workspace — deals, watchlist, intros, and messaging. You can browse opportunities right now while you finish.",
        primary: { href: "/investor/onboarding", label: "Continue onboarding" },
      };
  }
}

export function InvestorPendingApprovalPanel({
  approvalStatus,
  adminFeedback,
}: Readonly<{
  approvalStatus: InvestorApprovalStatus | string;
  adminFeedback?: string | null;
}>) {
  const c = contentFor(approvalStatus);
  const t = TONES[c.tone];
  const showFeedback = Boolean(adminFeedback) && (approvalStatus === "rejected" || approvalStatus === "changes_requested");

  return (
    <section className={`rounded-2xl border ${t.border} ${t.bg} p-8 shadow-sm`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${t.eyebrow}`}>{c.eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{c.title}</h2>
      <p className={`mt-3 max-w-2xl text-sm leading-6 ${t.body}`}>{c.body}</p>
      {showFeedback ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">What to change:</span> {adminFeedback}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={c.primary.href} className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${t.btn}`}>
          {c.primary.label}
        </Link>
        <Link href="/investor/dashboard" className={`rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold ${t.outline}`}>
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
