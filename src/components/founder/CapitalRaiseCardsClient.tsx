"use client";

import { useState, useEffect } from "react";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrawerKey = "interest" | "status" | "target";

interface PledgeSummary {
  totalPledged: number;
  investorCount: number;
  currency: string;
}

interface CompanyProps {
  funding_amount: number | null;
  is_published: boolean;
  review_status: string | null;
  status: string | null;
}

interface ActivityProps {
  interests: { id: string }[];
  introRequests: { id: string; status: string | null }[];
  savedDeals: { id: string }[];
}

interface Props {
  pledgeSummary: PledgeSummary;
  company: CompanyProps;
  investorActivity: ActivityProps | null;
  raiseStatus: string;
}

// ---------------------------------------------------------------------------
// Clickable card
// ---------------------------------------------------------------------------
function RaiseCard({
  label,
  value,
  sub,
  cta,
  accentColor,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  cta: string;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
      <p className="mt-3 text-xs font-semibold" style={{ color: accentColor }}>{cta} →</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer primitives
// ---------------------------------------------------------------------------
function DStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type BVariant = "success" | "medium" | "high" | "neutral" | "critical";
const BCLS: Record<BVariant, string> = {
  success:  "bg-[#EAF3DE] text-[#1E6D3C]",
  medium:   "bg-[#EEEDFE] text-[#3C3489]",
  high:     "bg-[#FAEEDA] text-[#854F0B]",
  neutral:  "bg-slate-100 text-slate-600",
  critical: "bg-[#FCEBEB] text-[#A32D2D]",
};

function BRow({ name, badge, variant = "neutral" }: { name: string; badge: string; variant?: BVariant }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${BCLS[variant]}`}>
        {badge}
      </span>
    </div>
  );
}

function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#534AB7" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>
          Founder Intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>{i + 1}.</span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer content
// ---------------------------------------------------------------------------
function DrawerContent({
  drawerKey,
  pledgeSummary,
  company,
  investorActivity,
  raiseStatus,
  onClose,
}: Props & { drawerKey: DrawerKey; onClose: () => void }) {
  const target = company.funding_amount ?? 0;
  const fillPct = target > 0 ? Math.min(100, Math.round((pledgeSummary.totalPledged / target) * 100)) : 0;
  const avgPledge =
    pledgeSummary.investorCount > 0
      ? Math.round(pledgeSummary.totalPledged / pledgeSummary.investorCount)
      : 0;
  const interestCount = investorActivity?.interests.length ?? 0;
  const introCount = investorActivity?.introRequests.length ?? 0;
  const savedCount = investorActivity?.savedDeals.length ?? 0;
  const pendingIntros = investorActivity?.introRequests.filter(
    (i) => i.status === null || i.status === "requested" || i.status === "pending",
  ).length ?? 0;

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
      aria-label="Close"
    >
      ✕
    </button>
  );

  // ── Indicative interest ───────────────────────────────────────────────────
  if (drawerKey === "interest") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Indicative interest</p>
            <p className="mt-0.5 text-xs text-slate-500">Non-binding pledges from investors on the platform</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Total pledged" value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} />
          <DStatBox label="Investors" value={String(pledgeSummary.investorCount)} />
          <DStatBox label="Avg pledge" value={avgPledge > 0 ? formatPledgeTotal(avgPledge, pledgeSummary.currency) : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Interest breakdown</p>
        <div className="mt-2">
          <BRow
            name="Total indicative pledges"
            badge={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
            variant={pledgeSummary.totalPledged > 0 ? "success" : "neutral"}
          />
          <BRow
            name="Investors pledging"
            badge={`${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}`}
            variant={pledgeSummary.investorCount > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Expressed interest (non-pledge)"
            badge={`${interestCount} investor${interestCount === 1 ? "" : "s"}`}
            variant={interestCount > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Intro requests"
            badge={`${introCount} pending`}
            variant={introCount > 0 ? "high" : "neutral"}
          />
          <BRow
            name="Saved deals"
            badge={`${savedCount} investor${savedCount === 1 ? "" : "s"}`}
            variant="neutral"
          />
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {pledgeSummary.totalPledged === 0
              ? "No indicative pledges yet. These appear once investors express formal interest in your listing on the marketplace — you need a published listing and complete data room to start receiving them."
              : `${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} in indicative interest from ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}. These are non-binding signals — not committed capital. ${avgPledge > 0 ? `Your average pledge size of ${formatPledgeTotal(avgPledge, pledgeSummary.currency)} helps calibrate your round structure.` : ""}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            pledgeSummary.investorCount === 0
              ? "No pledges yet. The fastest path to first interest is completing your data room — investors rarely pledge without reviewing your pitch deck and financial model."
              : `You have ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging ${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}. Schedule a call with each this week — pledges convert to commitments at a much higher rate after a direct conversation.`,
            pendingIntros > 0
              ? `${pendingIntros} unanswered intro request${pendingIntros === 1 ? "" : "s"} — these investors are actively trying to connect. Reply today to convert them into meetings and potential pledges.`
              : interestCount > 0
              ? `${interestCount} investor${interestCount === 1 ? " has" : "s have"} expressed interest but haven't formally pledged. Send each a personalised message with your latest metrics to nudge them toward a pledge.`
              : "Focus on getting your listing published with a complete data room. Investors who find compelling listings pledge within 48–72 hours of discovering them.",
            target > 0
              ? fillPct >= 50
                ? `You're at ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target — strong momentum. Use this traction in conversations with new investors as social proof.`
                : `You're at ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target. Focus on converting your ${interestCount + introCount} active signals into pledges — each one moves the needle visibly.`
              : "Set a funding target in your company settings to track progress and help investors assess whether your round fits their typical check size.",
          ]}
        />
      </div>
    );
  }

  // ── Raise status ──────────────────────────────────────────────────────────
  if (drawerKey === "status") {
    const isPublished = company.is_published;
    const reviewStatus = company.review_status ?? company.status ?? "draft";

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Raise status</p>
            <p className="mt-0.5 text-xs text-slate-500">Your listing visibility and review progress</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Status" value={raiseStatus} />
          <DStatBox label="Published" value={isPublished ? "Yes" : "No"} />
          <DStatBox label="Review" value={reviewStatus} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Status breakdown</p>
        <div className="mt-2">
          <BRow
            name="Marketplace visibility"
            badge={isPublished ? "Live" : "Not live"}
            variant={isPublished ? "success" : "critical"}
          />
          <BRow
            name="Listing status"
            badge={raiseStatus}
            variant={isPublished ? "success" : raiseStatus === "pending" ? "high" : "neutral"}
          />
          <BRow
            name="Review status"
            badge={reviewStatus}
            variant={
              reviewStatus === "approved" ? "success"
              : reviewStatus === "pending" ? "high"
              : reviewStatus === "rejected" ? "critical"
              : "neutral"
            }
          />
          <BRow
            name="Investor activity"
            badge={`${interestCount + introCount + savedCount} interactions`}
            variant={interestCount + introCount + savedCount > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Indicative pledges"
            badge={pledgeSummary.investorCount > 0 ? `${pledgeSummary.investorCount} investors` : "None yet"}
            variant={pledgeSummary.investorCount > 0 ? "success" : "neutral"}
          />
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {isPublished
              ? `Your listing is live on the iCapOS marketplace. Investors can discover your company, review your data room, and express interest. You currently have ${interestCount + introCount + savedCount} total investor interactions.`
              : reviewStatus === "pending"
              ? "Your listing is under review by the iCapOS team. Once approved it will be published to the marketplace and visible to investors. This typically takes 1–3 business days."
              : reviewStatus === "rejected"
              ? "Your listing was not approved in its current form. Review the feedback in your settings and resubmit — most rejections are resolved with minor profile updates."
              : "Your listing has not been submitted for review yet. Complete your company profile and submit — investors cannot find you until you're published."}
          </p>
        </div>

        <AdviceBox
          lines={[
            isPublished
              ? `Your listing is live. The key lever now is investor engagement — respond to all ${introCount} intro request${introCount === 1 ? "" : "s"} within 48 hours to maximise conversion.`
              : reviewStatus === "pending"
              ? "Your listing is under review — the next step is in the team's hands. Use this time to complete your data room so it's ready when you go live."
              : reviewStatus === "rejected"
              ? "Review the rejection reason in your settings. Most rejections are resolved by updating your company description, fixing missing fields, or uploading a current pitch deck."
              : "Complete your company profile and submit for review. Every day your listing isn't live is a day investors can't discover you.",
            isPublished && pledgeSummary.investorCount > 0
              ? `You have ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging — now is the time to schedule follow-up calls and convert pledges to commitments.`
              : isPublished
              ? "You're live but have no pledges yet. Share your iCapOS profile URL directly with warm contacts to accelerate first engagement."
              : "Before submitting, ensure your pitch deck is uploaded and your funding target is set — these are the two fields most commonly missing at review.",
            isPublished
              ? `Listings with complete data rooms receive ${pledgeSummary.totalPledged === 0 ? "3–5×" : "significantly"} more investor interactions. ${pledgeSummary.totalPledged === 0 ? "Upload any missing documents to improve your discoverability." : "Keep your documents current to maintain investor confidence."}`
              : "A complete data room (pitch deck, financial model, exec summary) increases your approval probability and dramatically improves investor engagement post-launch.",
          ]}
        />
      </div>
    );
  }

  // ── Funding target ────────────────────────────────────────────────────────
  const remaining = target > 0 ? Math.max(0, target - pledgeSummary.totalPledged) : 0;

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">Funding target</p>
          <p className="mt-0.5 text-xs text-slate-500">Your round size and progress toward it</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label="Target" value={target > 0 ? formatPledgeTotal(target, pledgeSummary.currency) : "TBD"} />
        <DStatBox label="Pledged" value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} />
        <DStatBox label="Filled" value={target > 0 ? `${fillPct}%` : "—"} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">Target breakdown</p>
      <div className="mt-2">
        <BRow
          name="Funding target"
          badge={target > 0 ? formatPledgeTotal(target, pledgeSummary.currency) : "Not set"}
          variant={target > 0 ? "medium" : "critical"}
        />
        <BRow
          name="Total pledged (indicative)"
          badge={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
          variant={pledgeSummary.totalPledged > 0 ? "success" : "neutral"}
        />
        <BRow
          name="Remaining to target"
          badge={target > 0 ? formatPledgeTotal(remaining, pledgeSummary.currency) : "—"}
          variant={remaining === 0 && target > 0 ? "success" : target > 0 ? "high" : "neutral"}
        />
        <BRow
          name="Fill percentage"
          badge={target > 0 ? `${fillPct}%` : "—"}
          variant={fillPct >= 75 ? "success" : fillPct >= 40 ? "medium" : "neutral"}
        />
        <BRow
          name="Investors pledging"
          badge={`${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}`}
          variant={pledgeSummary.investorCount > 0 ? "medium" : "neutral"}
        />
      </div>

      {target > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Raise progress</span>
            <span className="font-semibold" style={{ color: "#534AB7" }}>{fillPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: "#534AB7" }} />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {target === 0
            ? "You haven't set a funding target yet. Investors use your target to decide whether your round fits their check size — a missing target reduces your discoverability and investor confidence."
            : fillPct === 0
            ? `Your target is ${formatPledgeTotal(target, pledgeSummary.currency)} with 0% filled. This is the starting point — all raises begin here. Focus on getting your first pledge to create social proof.`
            : `You've filled ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target, with ${formatPledgeTotal(remaining, pledgeSummary.currency)} remaining. These are indicative pledges — not committed capital — but they signal real investor interest in your round.`}
        </p>
      </div>

      <AdviceBox
        lines={[
          target === 0
            ? "Set your funding target in Company settings immediately. It's one of the first things investors check — a missing target signals an undefined raise, which reduces engagement."
            : fillPct >= 75
            ? `At ${fillPct}% filled, you're in strong position. Focus on converting existing pledges to commitments rather than adding new investors — depth beats breadth at this stage.`
            : fillPct >= 40
            ? `At ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target, you have real momentum. Use this traction in outreach: "we're ${fillPct}% filled with ${pledgeSummary.investorCount} investors" is a powerful opener.`
            : pledgeSummary.totalPledged > 0
            ? `You have ${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} pledged — a real start. The next goal is ${formatPledgeTotal(Math.round(target * 0.25), pledgeSummary.currency)} (25%) to create social proof for new investors.`
            : `No pledges yet toward your ${formatPledgeTotal(target, pledgeSummary.currency)} target. First step: get 1–2 warm contacts to pledge, even small amounts — social proof accelerates every subsequent conversation.`,
          pledgeSummary.investorCount > 0 && remaining > 0
            ? `Your ${pledgeSummary.investorCount} current investor${pledgeSummary.investorCount === 1 ? "" : "s"} represent your best referral channel. Ask each if they know 2–3 other investors who fit your thesis — warm intros are 4× more likely to close.`
            : target > 0 && fillPct < 25
            ? "Review whether your target is calibrated to your stage. Seed rounds typically range $500K–$3M. An overly large target relative to your traction can deter investors who worry about lead investor dynamics."
            : "Maintain weekly investor updates to keep momentum — investors who receive regular updates are 2× more likely to convert from pledge to commitment.",
          target > 0 && remaining > 0
            ? `You need ${formatPledgeTotal(remaining, pledgeSummary.currency)} more to reach your target. With ${interestCount + introCount} active signals in your pipeline, converting even half of these would ${(interestCount + introCount) > 0 ? "materially close the gap" : "require expanding your investor outreach"}.`
            : target === 0
            ? "A realistic target also helps iCapOS match you with investors whose check sizes align — set it to improve your match quality."
            : "You're at or near your target. Confirm commitments with a signed term sheet before closing the round to new investors.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function CapitalRaiseCardsClient({
  pledgeSummary,
  company,
  investorActivity,
  raiseStatus,
}: Props) {
  const [open, setOpen] = useState<DrawerKey | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const target = company.funding_amount ?? 0;
  const fillPct = target > 0 ? Math.min(100, Math.round((pledgeSummary.totalPledged / target) * 100)) : 0;

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <RaiseCard
          label="Indicative interest"
          value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
          sub={`From ${pledgeSummary.investorCount} ${pledgeSummary.investorCount === 1 ? "investor" : "investors"}`}
          cta="View breakdown"
          accentColor="#4338CA"
          onClick={() => setOpen("interest")}
        />
        <RaiseCard
          label="Raise status"
          value={raiseStatus}
          sub={company.is_published ? "Live on marketplace" : "Not yet published"}
          cta={company.is_published ? "Fully live" : "View details"}
          accentColor={company.is_published ? "#15803d" : "#4338CA"}
          onClick={() => setOpen("status")}
        />
        <RaiseCard
          label="Funding target"
          value={target > 0 ? formatPledgeTotal(target, pledgeSummary.currency) : "TBD"}
          sub={target > 0 ? `${fillPct}% filled` : "Company funding goal"}
          cta="View breakdown"
          accentColor="#4338CA"
          onClick={() => setOpen("target")}
        />
      </section>

      {/* Centered slide-up modal — 448 × 536 px */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.35)" }}
          onClick={() => setOpen(null)}
        />

        {/* Drawer panel */}
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: open ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {open && (
            <DrawerContent
              drawerKey={open}
              pledgeSummary={pledgeSummary}
              company={company}
              investorActivity={investorActivity}
              raiseStatus={raiseStatus}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
