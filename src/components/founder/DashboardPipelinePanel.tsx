"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { FounderInvestorActivityResult } from "@/lib/data/investor-interests";
import { WorkspacePanel } from "@/components/WorkspacePanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrawerGroup = "interests" | "introRequests" | "savedDeals";

const DRAWER_CFG = {
  interests: {
    accent: "#2E78F5",
    accentBg: "#EEEDFE",
    label: "Expressed interest",
  },
  introRequests: {
    accent: "#854F0B",
    accentBg: "#FAEEDA",
    label: "Intro requests",
  },
  savedDeals: {
    accent: "#1E6D3C",
    accentBg: "#EAF3DE",
    label: "Saved deals",
  },
} as const;

// ---------------------------------------------------------------------------
// Helper — extract investor display name from profile ref
// ---------------------------------------------------------------------------
function investorName(
  profiles:
    | { full_name?: string | null; email?: string | null }
    | Array<{ full_name?: string | null; email?: string | null }>
    | null,
): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.full_name ?? p?.email ?? "Investor";
}

// ---------------------------------------------------------------------------
// PipelineClickCard
// ---------------------------------------------------------------------------
function PipelineClickCard({
  label,
  value,
  sub,
  accentColor,
  accentBg,
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  accentColor: string;
  accentBg: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
    >
      <span
        className="mb-2.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ background: accentBg, color: accentColor }}
      >
        {label}
      </span>
      <p className="text-[2rem] font-medium leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
      <div className="mt-3 border-t border-slate-100 pt-2">
        <span className="text-[11px] font-medium" style={{ color: accentColor }}>
          View details →
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// DrawerStatBox
// ---------------------------------------------------------------------------
function DrawerStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown row
// ---------------------------------------------------------------------------
type RowVariant = "medium" | "high" | "neutral" | "success";
const VARIANT_CLS: Record<RowVariant, string> = {
  medium: "bg-[#EEEDFE] text-[#1A6CE4]",
  high: "bg-[#FAEEDA] text-[#854F0B]",
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-[#EAF3DE] text-[#1E6D3C]",
};

function BRow({
  name,
  status,
  variant = "neutral",
}: {
  name: string;
  status: string;
  variant?: RowVariant;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${VARIANT_CLS[variant]}`}>
        {status}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI advice box
// ---------------------------------------------------------------------------
function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#2E78F5" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>
          Founder Intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: "#a5b4fc" }}>
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>
              {i + 1}.
            </span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer content per group
// ---------------------------------------------------------------------------
function DrawerContent({
  group,
  activity,
  onClose,
}: {
  group: DrawerGroup;
  activity: FounderInvestorActivityResult;
  onClose: () => void;
}) {
  const t = useTranslations("founderCmp");
  const cfg = DRAWER_CFG[group];
  const interestCount = activity.interests.length;
  const introCount = activity.introRequests.length;
  const savedCount = activity.savedDeals.length;
  const totalActivity = interestCount + introCount + savedCount;

  // ---- Interests ----
  if (group === "interests") {
    const pendingIntros = activity.introRequests.filter(
      (i) => i.status === null || i.status === "requested" || i.status === "pending",
    ).length;
    return (
      <div className="px-5 pb-6 pt-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("expressed_interest")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("investors_who_signalled_intent_on_your_listi")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <DrawerStatBox label={t("interested")} value={String(interestCount)} />
          <DrawerStatBox label={t("intro_requests")} value={String(introCount)} />
          <DrawerStatBox label={t("saved_deals")} value={String(savedCount)} />
        </div>

        {/* Breakdown */}
        <p className="mt-5 text-xs font-semibold text-slate-900">{t("investor_breakdown")}</p>
        <div className="mt-2">
          {interestCount === 0 ? (
            <p className="py-2 text-xs text-slate-500">{t("no_expressed_interest_yet")}</p>
          ) : (
            activity.interests.map((i) => (
              <BRow
                key={i.id}
                name={investorName(i.profiles)}
                status={i.pledge_amount ? `$${(i.pledge_amount / 1000).toFixed(0)}K interest` : "Expressed interest"}
                variant="medium"
              />
            ))
          )}
        </div>

        {/* What this means */}
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {interestCount === 0
              ? "No investor has expressed interest yet. Make sure your listing is published and your pitch deck is current."
              : `${interestCount} investor${interestCount === 1 ? " has" : "s have"} signalled intent by clicking "Interested" on your listing. This is a non-binding signal — follow up with each to convert interest into an intro or pledge.${pendingIntros > 0 ? ` You also have ${pendingIntros} pending intro request${pendingIntros === 1 ? "" : "s"} that need a response.` : ""}`}
          </p>
        </div>

        {/* AI advice */}
        <AdviceBox
          lines={[
            interestCount === 0
              ? "No interest yet. Upload your pitch deck and publish your listing — investors can't discover you without it."
              : `You have ${interestCount} interested investor${interestCount === 1 ? "" : "s"}. Reach out to each within 48 hours while the signal is fresh — wait time is inversely correlated with conversion.`,
            pendingIntros > 0
              ? `${pendingIntros} investor${pendingIntros === 1 ? " is" : "s are"} waiting for an intro response. This is your highest-priority action — reply today to keep momentum.`
              : interestCount > 0
              ? "None of these investors have requested an intro yet. Send each a short personalised message through the platform to prompt the next step."
              : "Focus on completing your data room first. Investors rarely express interest in listings with missing pitch decks or financial models.",
            totalActivity > 0
              ? `With ${totalActivity} total interaction${totalActivity === 1 ? "" : "s"} across interest, intros, and saved deals, you have real market signal. Prioritise the investors who have taken multiple actions.`
              : "Once you have interest, use the investor breakdown above to identify who has taken multiple actions — they are your warmest leads.",
          ]}
        />
      </div>
    );
  }

  // ---- Intro requests ----
  if (group === "introRequests") {
    const pending = activity.introRequests.filter(
      (i) => i.status === null || i.status === "requested" || i.status === "pending",
    );
    const responded = activity.introRequests.filter(
      (i) => i.status !== null && i.status !== "requested" && i.status !== "pending",
    );
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("intro_requests")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("investors_actively_trying_to_connect_with_yo")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DrawerStatBox label={t("total_requests")} value={String(introCount)} />
          <DrawerStatBox label={t("awaiting_reply")} value={String(pending.length)} />
          <DrawerStatBox label={t("responded")} value={String(responded.length)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("request_breakdown")}</p>
        <div className="mt-2">
          {introCount === 0 ? (
            <p className="py-2 text-xs text-slate-500">{t("no_intro_requests_yet")}</p>
          ) : (
            activity.introRequests.map((i) => (
              <BRow
                key={i.id}
                name={investorName(i.profiles)}
                status={i.status ?? "Requested"}
                variant={
                  i.status === null || i.status === "requested" || i.status === "pending"
                    ? "high"
                    : i.status === "accepted" || i.status === "approved"
                    ? "success"
                    : "neutral"
                }
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {introCount === 0
              ? "No intro requests yet. Investors who view your listing can request an intro — make sure your profile is published and compelling."
              : `${introCount} investor${introCount === 1 ? " has" : "s have"} formally requested an intro — this is the highest-intent action an investor takes before a meeting. ${pending.length > 0 ? `${pending.length} request${pending.length === 1 ? " is" : "s are"} still awaiting your reply.` : "You've responded to all requests."}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            pending.length > 0
              ? `${pending.length} unanswered intro request${pending.length === 1 ? "" : "s"} — every day without a response reduces your conversion rate. Block 30 minutes today and reply to each.`
              : introCount > 0
              ? "You've responded to all intro requests. Follow up with any investors you haven't heard back from within 5 business days."
              : "No intro requests yet. If you have interested investors, send each a short message inviting them to request a formal intro.",
            introCount > 0
              ? `Investors who request intros convert to meetings at 3–4× the rate of passive interest. Treat each request as a near-certain first meeting opportunity.`
              : "Investors typically request intros only when your listing score is above 70 and your data room is complete. Check your readiness score above.",
            responded.length > 0
              ? `You've responded to ${responded.length} intro${responded.length === 1 ? "" : "s"}. Make sure each has a calendar invite sent — a response without a scheduled meeting rarely converts.`
              : "Once you start receiving intros, prioritise scheduling calls within 48 hours. Urgency signals seriousness and keeps investors engaged.",
          ]}
        />
      </div>
    );
  }

  // ---- Saved deals ----
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{t("saved_deals")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("investors_who_bookmarked_your_listing_to_ret")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DrawerStatBox label={t("saved")} value={String(savedCount)} />
        <DrawerStatBox label={t("also_interested")} value={String(interestCount)} />
        <DrawerStatBox label={t("intro_requests")} value={String(introCount)} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">{t("investor_breakdown")}</p>
      <div className="mt-2">
        {savedCount === 0 ? (
          <p className="py-2 text-xs text-slate-500">{t("no_saved_deals_yet")}</p>
        ) : (
          activity.savedDeals.map((i) => (
            <BRow
              key={i.id}
              name={investorName(i.profiles)}
              status="Saved"
              variant="neutral"
            />
          ))
        )}
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {savedCount === 0
            ? "No investors have saved your deal yet. Saving typically happens when an investor wants to track a deal but isn't ready to express interest — it's a soft signal worth nurturing."
            : `${savedCount} investor${savedCount === 1 ? " has" : "s have"} bookmarked your listing. Saves indicate genuine interest that hasn't yet converted to formal action. These are warm prospects who return to your profile — an update or new document often triggers the next step.`}
        </p>
      </div>

      <AdviceBox
        lines={[
          savedCount === 0
            ? "Improve your listing summary to encourage saves. Investors save deals with a clear stage, compelling summary, and a realistic target raise amount."
            : `${savedCount} investor${savedCount === 1 ? " has" : "s have"} saved your deal. Post a meaningful update — a new financial milestone, customer win, or document upload — to bring them back to your profile.`,
          savedCount > 0
            ? "Saved deals convert to active interest when triggered by a specific event. Share your updated pitch deck or a key metric improvement with your warm pipeline this week."
            : "Once you have saves, you can use them as social proof: 'multiple investors are tracking this round' is a powerful signal in outreach to new investors.",
          totalActivity > 0
            ? `You have ${totalActivity} total touchpoints across interest, intros, and saves. Investors who appear in multiple categories are your highest-priority follow-ups.`
            : "Focus on getting your listing published with a complete data room — saves and interest both increase sharply once investors can see your documentation.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function DashboardPipelinePanel({
  activity,
}: {
  activity: FounderInvestorActivityResult;
}) {
  const t = useTranslations("founderCmp");
  const [drawerGroup, setDrawerGroup] = useState<DrawerGroup | null>(null);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = drawerGroup ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerGroup]);

  const interestCount = activity.interests.length;
  const introCount = activity.introRequests.length;
  const savedCount = activity.savedDeals.length;

  return (
    <WorkspacePanel title={t("investor_pipeline")} subtitle={t("read_only_activity_on_your_listing")}>
      <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-3">
        <PipelineClickCard
          label={t("expressed_interest")}
          value={interestCount}
          sub={interestCount === 1 ? "1 investor interested" : `${interestCount} investors interested`}
          accentColor={DRAWER_CFG.interests.accent}
          accentBg={DRAWER_CFG.interests.accentBg}
          onClick={() => setDrawerGroup("interests")}
        />
        <PipelineClickCard
          label={t("intro_requests")}
          value={introCount}
          sub={introCount === 1 ? "1 request pending" : `${introCount} requests`}
          accentColor={DRAWER_CFG.introRequests.accent}
          accentBg={DRAWER_CFG.introRequests.accentBg}
          onClick={() => setDrawerGroup("introRequests")}
        />
        <PipelineClickCard
          label={t("saved_deals")}
          value={savedCount}
          sub={savedCount === 1 ? "1 investor saved" : `${savedCount} investors saved`}
          accentColor={DRAWER_CFG.savedDeals.accent}
          accentBg={DRAWER_CFG.savedDeals.accentBg}
          onClick={() => setDrawerGroup("savedDeals")}
        />
      </div>

      {/* Slide-up drawer */}
      <div
        className="pointer-events-none fixed inset-0 z-50 transition-opacity duration-200"
        style={{
          opacity: drawerGroup ? 1 : 0,
          pointerEvents: drawerGroup ? "auto" : "none",
        }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.28)" }}
          onClick={() => setDrawerGroup(null)}
        />
        {/* Drawer panel */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-y-auto"
          style={{
            background: "white",
            borderRadius: "16px 16px 0 0",
            borderTop: "0.5px solid #e2e8f0",
            maxHeight: "56vh",
            transform: drawerGroup ? "translateY(0)" : "translateY(100%)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {drawerGroup && (
            <DrawerContent
              group={drawerGroup}
              activity={activity}
              onClose={() => setDrawerGroup(null)}
            />
          )}
        </div>
      </div>
    </WorkspacePanel>
  );
}
