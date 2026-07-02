"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrawerKey = "pledged" | "investors";

interface PledgeSummary {
  totalPledged: number;
  investorCount: number;
  currency: string;
}

interface ActivityProps {
  interests: { id: string }[];
  introRequests: { id: string; status: string | null }[];
  savedDeals: { id: string }[];
}

interface Props {
  pledgeSummary: PledgeSummary;
  investorActivity: ActivityProps | null;
  fundingAmount: number | null;
}

// ---------------------------------------------------------------------------
// Clickable card — matches original indigo/slate styling
// ---------------------------------------------------------------------------
function OverviewCard({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  accent: "indigo" | "slate";
  onClick: () => void;
}) {
  const t = useTranslations("founderCmp");
  const base =
    accent === "indigo"
      ? "rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100 transition hover:shadow-sm hover:ring-indigo-300 cursor-pointer w-full text-left active:scale-[0.99]"
      : "rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100 transition hover:shadow-sm hover:ring-slate-200 cursor-pointer w-full text-left active:scale-[0.99]";
  const labelCls = accent === "indigo" ? "text-sm font-medium text-indigo-700" : "text-sm font-medium text-slate-600";

  return (
    <button type="button" className={base} onClick={onClick}>
      <p className={labelCls}>{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-[10px] font-semibold text-indigo-400">{t("view_breakdown_2")}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer primitives (identical to CapitalRaiseCardsClient)
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
  success: "bg-[#EAF3DE] text-[#1E6D3C]",
  medium: "bg-[#EEEDFE] text-[#3C3489]",
  high: "bg-[#FAEEDA] text-[#854F0B]",
  neutral: "bg-slate-100 text-slate-600",
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
  investorActivity,
  fundingAmount,
  onClose,
}: Props & { drawerKey: DrawerKey; onClose: () => void }) {
  const t = useTranslations("founderCmp");
  const target = fundingAmount ?? 0;
  const fillPct = target > 0 ? Math.min(100, Math.round((pledgeSummary.totalPledged / target) * 100)) : 0;
  const avgPledge =
    pledgeSummary.investorCount > 0
      ? Math.round(pledgeSummary.totalPledged / pledgeSummary.investorCount)
      : 0;
  const interestCount = investorActivity?.interests.length ?? 0;
  const introCount = investorActivity?.introRequests.length ?? 0;
  const savedCount = investorActivity?.savedDeals.length ?? 0;
  const pendingIntros =
    investorActivity?.introRequests.filter(
      (i) => i.status === null || i.status === "requested" || i.status === "pending",
    ).length ?? 0;
  const totalSignals = interestCount + introCount + savedCount;

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

  // ── Total pledged ────────────────────────────────────────────────────────
  if (drawerKey === "pledged") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("total_pledged")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("non_binding_indicative_interest_from_investo")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("total_pledged")} value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} />
          <DStatBox label={t("avg_pledge")} value={avgPledge > 0 ? formatPledgeTotal(avgPledge, pledgeSummary.currency) : "—"} />
          <DStatBox label={t("round_fill")} value={target > 0 ? `${fillPct}%` : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("pledge_breakdown")}</p>
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
            name="Funding target"
            badge={target > 0 ? formatPledgeTotal(target, pledgeSummary.currency) : "Not set"}
            variant={target > 0 ? "medium" : "high"}
          />
          <BRow
            name="Remaining to target"
            badge={target > 0 ? formatPledgeTotal(Math.max(0, target - pledgeSummary.totalPledged), pledgeSummary.currency) : "—"}
            variant={target > 0 && pledgeSummary.totalPledged >= target ? "success" : target > 0 ? "high" : "neutral"}
          />
          <BRow
            name="Pipeline signals"
            badge={`${totalSignals} active`}
            variant={totalSignals > 0 ? "medium" : "neutral"}
          />
        </div>

        {target > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{t("round_progress")}</span>
              <span className="font-semibold" style={{ color: "#534AB7" }}>{fillPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: "#534AB7" }} />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {pledgeSummary.totalPledged === 0
              ? "No indicative pledges yet. Pledges appear when investors formally express interest in your listing — you need a published listing and a complete data room to start receiving them."
              : `${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} in indicative interest from ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}. These are non-binding signals, not committed capital. ${target > 0 ? `You're at ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target.` : "Setting a funding target will let investors assess whether your round fits their check size."}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            pledgeSummary.investorCount === 0
              ? "No pledges yet. The fastest path to first interest is completing your data room — investors rarely pledge without reviewing your pitch deck and financial model."
              : `You have ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging ${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}. Schedule a call with each this week — pledges convert to commitments at much higher rates after a direct conversation.`,
            pendingIntros > 0
              ? `${pendingIntros} unanswered intro request${pendingIntros === 1 ? "" : "s"} — these investors are actively trying to connect. Reply today to convert them into meetings and potential pledges.`
              : totalSignals > 0
              ? `${totalSignals} investors are tracking your deal. Send each a personalised update with your latest metrics to nudge them toward a formal pledge.`
              : "Focus on publishing your listing with a complete data room. Investors who find compelling listings typically pledge within 48–72 hours of discovering them.",
            target > 0 && fillPct < 50
              ? `At ${fillPct}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target, the key lever is converting your ${totalSignals} pipeline signals into pledges — each new pledge also creates social proof that accelerates the next one.`
              : target > 0 && fillPct >= 50
              ? `You're at ${fillPct}% of target — strong momentum. Use this traction in conversations: "we're ${fillPct}% filled with ${pledgeSummary.investorCount} investors" is a powerful social-proof opener.`
              : "Set a funding target in Company settings to track round progress and help investors evaluate fit — it's one of the first things investors check.",
          ]}
        />
      </div>
    );
  }

  // ── Investor count ────────────────────────────────────────────────────────
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{t("investor_count")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("all_investors_actively_engaged_with_your_rai")}</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label={t("total_investors")} value={String(pledgeSummary.investorCount + interestCount + introCount + savedCount)} />
        <DStatBox label={t("pledging")} value={String(pledgeSummary.investorCount)} />
        <DStatBox label={t("in_pipeline")} value={String(totalSignals)} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">{t("investor_funnel")}</p>
      <div className="mt-2">
        <BRow
          name="Investors pledging"
          badge={`${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}`}
          variant={pledgeSummary.investorCount > 0 ? "success" : "neutral"}
        />
        <BRow
          name="Expressed interest"
          badge={`${interestCount} investor${interestCount === 1 ? "" : "s"}`}
          variant={interestCount > 0 ? "medium" : "neutral"}
        />
        <BRow
          name="Intro requests"
          badge={`${introCount} total · ${pendingIntros} pending`}
          variant={pendingIntros > 0 ? "high" : introCount > 0 ? "medium" : "neutral"}
        />
        <BRow
          name="Saved deals"
          badge={`${savedCount} investor${savedCount === 1 ? "" : "s"}`}
          variant={savedCount > 0 ? "medium" : "neutral"}
        />
        <BRow
          name="Total unique investors"
          badge={String(pledgeSummary.investorCount + interestCount + introCount + savedCount)}
          variant={pledgeSummary.investorCount + interestCount + introCount + savedCount > 0 ? "medium" : "neutral"}
        />
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {pledgeSummary.investorCount + totalSignals === 0
            ? "No investor activity yet. Get your listing published and your data room complete — those are the two biggest drivers of investor discovery and engagement on the platform."
            : `${pledgeSummary.investorCount + totalSignals} investor${pledgeSummary.investorCount + totalSignals === 1 ? " is" : "s are"} actively engaged with your raise across all stages. ${pledgeSummary.investorCount > 0 ? `${pledgeSummary.investorCount} ${pledgeSummary.investorCount === 1 ? "has" : "have"} made indicative pledges — the highest-intent signal. ` : ""}${pendingIntros > 0 ? `${pendingIntros} unanswered intro request${pendingIntros === 1 ? "" : "s"} need your attention.` : ""}`}
        </p>
      </div>

      <AdviceBox
        lines={[
          pledgeSummary.investorCount === 0 && totalSignals === 0
            ? "No investor activity yet. The two fastest levers are: (1) ensure your listing is published and (2) upload a current pitch deck — these are the top two missing items for most unengaged listings."
            : pledgeSummary.investorCount > 0
            ? `${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? " has" : "s have"} pledged — these are your highest-priority relationships. Follow up with each personally this week to begin converting indicative interest into committed capital.`
            : `No pledges yet, but ${totalSignals} investors are in your pipeline. Your next goal is converting one of these into a formal pledge — start with the ${introCount > 0 ? `${introCount} intro request${introCount === 1 ? "" : "s"}` : `${interestCount} interested investor${interestCount === 1 ? "" : "s"}`} as they've shown the strongest intent.`,
          pendingIntros > 0
            ? `${pendingIntros} unanswered intro request${pendingIntros === 1 ? "" : "s"} — investors who request introductions are 4–6× more likely to pledge than passive browsers. These are your hottest leads right now.`
            : interestCount > 0
            ? `${interestCount} investor${interestCount === 1 ? " has" : "s have"} expressed formal interest. Send each a personalised message with your latest metrics and a calendar link — converting 1–2 into intro calls this week will compound your pipeline.`
            : savedCount > 0
            ? `${savedCount} investor${savedCount === 1 ? " has" : "s have"} saved your deal — they're tracking it without committing. A direct message referencing recent company progress can re-activate their interest.`
            : "Build your pipeline by sharing your iCapOS profile with warm contacts. Personal introductions convert to pledges at 3–5× the rate of cold discovery.",
          pledgeSummary.investorCount + totalSignals > 0
            ? `Investor velocity matters as much as total count. ${pledgeSummary.investorCount + totalSignals} total engaged investors is a real signal — log every interaction and track response rates to identify which outreach channels are working.`
            : "Once you have your first investor engaged, focus on deepening that relationship before broadening outreach — one strong reference investor anchors your round credibility.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function CapitalRaiseOverviewClient({ pledgeSummary, investorActivity, fundingAmount }: Props) {
  const t = useTranslations("founderCmp");
  const [open, setOpen] = useState<DrawerKey | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <OverviewCard
          label={t("total_pledged")}
          value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
          accent="indigo"
          onClick={() => setOpen("pledged")}
        />
        <OverviewCard
          label={t("investor_count")}
          value={String(pledgeSummary.investorCount)}
          accent="slate"
          onClick={() => setOpen("investors")}
        />
      </div>

      {/* Centered 448 × 536 slide-up modal */}
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
              investorActivity={investorActivity}
              fundingAmount={fundingAmount}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
