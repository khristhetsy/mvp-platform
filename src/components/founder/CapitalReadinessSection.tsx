"use client";

import { useState, useCallback } from "react";
import type { FounderInvestorActivityResult } from "@/lib/data/investor-interests";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";

type DrawerKey = "readiness" | "raise" | "interest" | "activity";

interface DocRecord {
  id: string;
  file_name?: string | null;
  document_type?: string | null;
  status?: string | null;
}

interface PledgeSummary {
  totalPledged: number;
  investorCount: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// SVG donut chart
// ---------------------------------------------------------------------------
function DonutChart({
  pct,
  color,
  color2,
  pct2,
  size = 48,
}: {
  pct: number;
  color: string;
  color2?: string;
  pct2?: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.375;
  const sw = size * 0.125;

  function arc(fromPct: number, toPct: number) {
    if (toPct - fromPct < 0.001) return "";
    const a1 = fromPct * 2 * Math.PI - Math.PI / 2;
    const a2 = toPct * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const large = toPct - fromPct > 0.5 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  const c1 = Math.max(0.02, Math.min(1, pct));
  const c2 = color2 && pct2 ? Math.max(0, Math.min(1 - c1, pct2)) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEEDFE" strokeWidth={sw} />
      <path d={arc(0, c1)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {c2 > 0 && color2 ? (
        <path d={arc(c1, c1 + c2)} fill="none" stroke={color2} strokeWidth={sw} strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------
function PriBadge({ level }: { level: "critical" | "high" | "medium" | "low" }) {
  const cfg = {
    critical: "bg-[#FCEBEB] text-[#A32D2D]",
    high: "bg-[#FAEEDA] text-[#854F0B]",
    medium: "bg-[#EEEDFE] text-[#3C3489]",
    low: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${cfg[level]}`}>
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat box
// ---------------------------------------------------------------------------
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI advice box
// ---------------------------------------------------------------------------
function AdviceBox({ items }: { items: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#0c2340" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: "#534AB7" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#EEEDFE" }}>
          Founder intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2.5 text-xs leading-relaxed" style={{ color: "#AFA9EC" }}>
            <span className="shrink-0 font-semibold" style={{ color: "#7F77DD" }}>
              {i + 1}.
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown list row
// ---------------------------------------------------------------------------
function BRow({
  name,
  status,
  variant = "neutral",
}: {
  name: string;
  status: string;
  variant?: "critical" | "high" | "medium" | "neutral" | "success";
}) {
  const cls = {
    critical: "bg-[#FCEBEB] text-[#A32D2D]",
    high: "bg-[#FAEEDA] text-[#854F0B]",
    medium: "bg-[#EEEDFE] text-[#3C3489]",
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-[#EAF3DE] text-[#3B6D11]",
  };
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${cls[variant]}`}>
        {status}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function investorName(
  profiles: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null,
): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.full_name ?? p?.email ?? "Investor";
}

const REQUIRED_DOC_TYPES = [
  "PITCH_DECK",
  "FINANCIAL_MODEL",
  "EXECUTIVE_SUMMARY",
  "CAP_TABLE",
  "AUDITED_FINANCIALS",
  "LEGAL_STRUCTURE",
  "TEAM_BIOS",
  "PRODUCT_ROADMAP",
  "MARKET_ANALYSIS",
];
const DOC_LABELS: Record<string, string> = {
  PITCH_DECK: "Pitch deck",
  FINANCIAL_MODEL: "Financial model",
  EXECUTIVE_SUMMARY: "Executive summary",
  CAP_TABLE: "Cap table",
  AUDITED_FINANCIALS: "Audited financials",
  LEGAL_STRUCTURE: "Legal structure",
  TEAM_BIOS: "Team bios",
  PRODUCT_ROADMAP: "Product roadmap",
  MARKET_ANALYSIS: "Market analysis",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CapitalReadinessSection({
  readinessScore,
  readinessDetail,
  raiseProgress,
  companyStatus,
  companyFundingAmount,
  pledgeSummary,
  investorActivityTotal,
  investorActivity,
  documents,
}: {
  readinessScore: number;
  readinessDetail: string;
  raiseProgress: string;
  companyStatus: string | null;
  companyFundingAmount: number | null;
  pledgeSummary: PledgeSummary;
  investorActivityTotal: number;
  investorActivity: FounderInvestorActivityResult | null;
  documents: DocRecord[];
}) {
  const [open, setOpen] = useState<DrawerKey | null>(null);
  const close = useCallback(() => setOpen(null), []);

  // Derived
  const uploadedTypes = new Set(documents.map((d) => d.document_type).filter(Boolean) as string[]);
  const uploadedCount = uploadedTypes.size;
  const missingTypes = REQUIRED_DOC_TYPES.filter((t) => !uploadedTypes.has(t));
  const totalActivity = investorActivityTotal;
  const interestCount = investorActivity?.interests.length ?? 0;
  const introCount = investorActivity?.introRequests.length ?? 0;
  const savedCount = investorActivity?.savedDeals.length ?? 0;
  const target = companyFundingAmount ?? 0;
  const fillPct = target > 0 ? Math.min(1, pledgeSummary.totalPledged / target) : 0;

  // -------------------------------------------------------------------------
  // Drawer configs
  // -------------------------------------------------------------------------
  const drawerConfig = {
    readiness: {
      title: "Readiness score",
      sub: "Your investor-readiness across all diligence factors",
      stats: [
        { label: "Overall score", value: `${readinessScore}/100` },
        { label: "Docs uploaded", value: `${uploadedCount}/${REQUIRED_DOC_TYPES.length}` },
        { label: "Critical gaps", value: String(missingTypes.length) },
      ],
      breakdown: (
        <div>
          {REQUIRED_DOC_TYPES.map((type) =>
            uploadedTypes.has(type) ? (
              <BRow key={type} name={DOC_LABELS[type] ?? type} status="Uploaded" variant="success" />
            ) : (
              <BRow key={type} name={DOC_LABELS[type] ?? type} status="Missing" variant="critical" />
            ),
          )}
        </div>
      ),
      meaning: `A score of ${readinessScore} means ${readinessScore >= 80 ? "your company is in the top tier for institutional investor review" : readinessScore >= 60 ? "you have the core narrative in place but are missing financial verification documents investors rely on most" : "you need to close several document gaps before institutional investors will take a first meeting"}. ${readinessScore < 80 ? `Institutional investors typically require a score of 80+ before taking a first meeting.` : "Focus on keeping documents current and addressing the remaining gaps."}`,
      advice: [
        missingTypes.includes("AUDITED_FINANCIALS")
          ? `Upload audited financials immediately — this single document can add 10–15 points to your score and unblocks investors who auto-filter for it.`
          : `Your financial documents are uploaded. Schedule a refresh with your accountant if the last audit was more than 12 months ago.`,
        missingTypes.length > 0
          ? `You have ${missingTypes.length} missing document${missingTypes.length === 1 ? "" : "s"}: ${missingTypes.slice(0, 2).map((t) => DOC_LABELS[t]).join(", ")}${missingTypes.length > 2 ? ` and ${missingTypes.length - 2} more` : ""}. Each one closes a common investor objection before you even take a call.`
          : `All core documents are uploaded. Make sure each file is current — investors check upload dates during diligence.`,
        readinessScore < 90
          ? `Getting to ${Math.min(100, readinessScore + 15)} requires completing your remaining ${missingTypes.length} document${missingTypes.length === 1 ? "" : "s"} and ensuring your pitch deck references audited numbers. Set a 2-week target.`
          : `Your score of ${readinessScore} is excellent. The next leverage point is investor engagement — respond to all intro requests within 24 hours to convert signals into meetings.`,
      ],
    },
    raise: {
      title: "Raise progress",
      sub: "Status of your active capital raise on CapitalOS",
      stats: [
        { label: "Listing status", value: raiseProgress },
        { label: "Funding target", value: target > 0 ? formatPledgeTotal(target, pledgeSummary.currency) : "TBD" },
        { label: "Target filled", value: target > 0 ? `${Math.round(fillPct * 100)}%` : "—" },
      ],
      breakdown: (
        <div>
          <BRow name="Listing published" status={raiseProgress === "Published" ? "Live" : "Not live"} variant={raiseProgress === "Published" ? "success" : "critical"} />
          <BRow name="Company profile" status={companyStatus ?? "Pending"} variant={companyStatus === "approved" ? "success" : "medium"} />
          <BRow name="Data room" status={uploadedCount > 0 ? "Active" : "Empty"} variant={uploadedCount > 0 ? "success" : "high"} />
          <BRow name="Indicative pledges" status={pledgeSummary.investorCount > 0 ? `${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"}` : "None yet"} variant={pledgeSummary.investorCount > 0 ? "success" : "neutral"} />
          <BRow name="Investor activity" status={totalActivity > 0 ? `${totalActivity} interactions` : "No activity"} variant={totalActivity > 0 ? "medium" : "neutral"} />
        </div>
      ),
      meaning: `Your listing is ${raiseProgress === "Published" ? "live on the marketplace and receiving traffic" : "not yet published — investors cannot find you"}. ${target > 0 ? `At ${Math.round(fillPct * 100)}% of your ${formatPledgeTotal(target, pledgeSummary.currency)} target with ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging interest, you are in ${fillPct > 0.5 ? "strong" : fillPct > 0.2 ? "early" : "very early"} momentum.` : "Set a funding target to track your raise progress."}`,
      advice: [
        raiseProgress !== "Published"
          ? `Your listing is not live. Complete your company profile and submit for admin review — you are invisible to investors until published.`
          : pledgeSummary.investorCount === 0
          ? `You're published but have 0 pledges. Review your pitch deck for clarity, ensure your funding target is realistic, and share your CapitalOS profile directly with warm contacts.`
          : `You have ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging ${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}. Schedule calls with each to move from indication to commitment.`,
        missingTypes.length > 0
          ? `Your data room is incomplete — ${missingTypes.length} document${missingTypes.length === 1 ? "" : "s"} missing. Investors who open your profile expect a full data room. Uploading ${missingTypes[0] ? DOC_LABELS[missingTypes[0]] ?? missingTypes[0] : "missing documents"} first is highest priority.`
          : `Your data room is complete. Make sure each document is current and dated within the last 12 months before taking investor meetings.`,
        target > 0 && fillPct < 1
          ? `You need ${formatPledgeTotal(target - pledgeSummary.totalPledged, pledgeSummary.currency)} more to reach your target. At your current pace, focus on converting your ${interestCount} expressed interest${interestCount === 1 ? "" : "s"} and ${introCount} pending intro${introCount === 1 ? "" : "s"} into committed pledges.`
          : `Set a clear funding target if you haven't — investors use it to gauge round structure and decide whether your raise fits their typical check size.`,
      ],
    },
    interest: {
      title: "Indicative interest",
      sub: "Non-binding pledges from investors on the platform",
      stats: [
        { label: "Total pledged", value: formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency) },
        { label: "Investors", value: String(pledgeSummary.investorCount) },
        { label: "Avg pledge", value: pledgeSummary.investorCount > 0 ? formatPledgeTotal(Math.round(pledgeSummary.totalPledged / pledgeSummary.investorCount), pledgeSummary.currency) : "—" },
      ],
      breakdown: (
        <div>
          {pledgeSummary.investorCount === 0 ? (
            <p className="py-2 text-xs text-slate-500">No pledges yet. Publish your listing to start receiving interest.</p>
          ) : (
            <>
              <BRow name="Indicative pledge total" status={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} variant="success" />
              <BRow name="Expressed interest" status={`${interestCount} investor${interestCount === 1 ? "" : "s"}`} variant={interestCount > 0 ? "medium" : "neutral"} />
              <BRow name="Intro requests" status={`${introCount} pending`} variant={introCount > 0 ? "high" : "neutral"} />
              <BRow name="Saved deals" status={`${savedCount} investor${savedCount === 1 ? "" : "s"}`} variant="neutral" />
              <BRow name="Pledges are non-binding" status="Indicative only" variant="neutral" />
            </>
          )}
        </div>
      ),
      meaning: `These pledges are non-binding expressions of interest, not committed capital. They signal investor intent and help validate your raise to other investors. ${pledgeSummary.investorCount > 0 ? `Your average pledge of ${formatPledgeTotal(Math.round(pledgeSummary.totalPledged / pledgeSummary.investorCount), pledgeSummary.currency)} is a data point for calibrating your round structure.` : "Pledges appear once investors express interest in your listing."}`,
      advice: [
        pledgeSummary.investorCount === 0
          ? `You have 0 pledges. The fastest path to first interest is completing your data room — investors don't pledge until they can review your documents.`
          : `You have ${pledgeSummary.investorCount} investor${pledgeSummary.investorCount === 1 ? "" : "s"} pledging ${formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)} — none of these are committed. Schedule a call with each this week to move toward a term sheet.`,
        introCount > 0
          ? `You have ${introCount} unanswered intro request${introCount === 1 ? "" : "s"}. Every day without a response reduces conversion probability. Reply today even just to set a meeting time.`
          : `You have no pending intro requests. Make sure your listing is published and your summary is compelling — the intro request is the primary first-contact action for investors.`,
        `Once you have 3+ pledges, use them as social proof with other investors. A "we have ${pledgeSummary.investorCount + 2} investors in at similar levels" line in outreach increases conversion significantly.`,
      ],
    },
    activity: {
      title: "Investor activity",
      sub: "All investor interactions across your listing",
      stats: [
        { label: "Total interactions", value: String(totalActivity) },
        { label: "Expressed interest", value: String(interestCount) },
        { label: "Intro requests", value: String(introCount) },
      ],
      breakdown: (
        <div>
          {interestCount === 0 && introCount === 0 && savedCount === 0 ? (
            <p className="py-2 text-xs text-slate-500">No investor activity yet. Publish your listing to start receiving interactions.</p>
          ) : null}
          {investorActivity?.interests.slice(0, 4).map((i) => (
            <BRow key={i.id} name={investorName(i.profiles)} status="Expressed interest" variant="medium" />
          ))}
          {investorActivity?.introRequests.slice(0, 3).map((i) => (
            <BRow key={i.id} name={investorName(i.profiles)} status={`Intro · ${i.status ?? "requested"}`} variant="high" />
          ))}
          {investorActivity?.savedDeals.slice(0, 3).map((i) => (
            <BRow key={i.id} name={investorName(i.profiles)} status="Saved deal" variant="neutral" />
          ))}
          {totalActivity === 0 && (
            <BRow name="Investor pipeline" status="No activity yet" variant="neutral" />
          )}
        </div>
      ),
      meaning: `${totalActivity === 0 ? "No investor interactions yet. Activity appears once your listing is live and investors find you on the marketplace." : `${totalActivity} investor interaction${totalActivity === 1 ? "" : "s"} across ${interestCount} interest${interestCount === 1 ? "" : "s"}, ${introCount} intro${introCount === 1 ? "" : "s"}, and ${savedCount} saved deal${savedCount === 1 ? "" : "s"}.`} ${introCount > 0 ? "Unanswered intro requests are your most urgent action — these investors are actively trying to connect." : ""}`,
      advice: [
        introCount > 0
          ? `You have ${introCount} unanswered intro request${introCount === 1 ? "" : "s"}. These are investors actively trying to reach you. Reply within 24 hours — response rate is one of the strongest predictors of deal close.`
          : interestCount > 0
          ? `You have ${interestCount} investor${interestCount === 1 ? "" : "s"} who expressed interest but no intro requests yet. Reach out proactively through the platform to schedule calls — don't wait for them to request an intro.`
          : `No investor activity yet. Make sure your listing is published, your pitch deck is current, and your company summary clearly states your stage and target raise amount.`,
        savedCount > 0
          ? `${savedCount} investor${savedCount === 1 ? " has" : "s have"} saved your deal but haven't expressed interest. These are warm prospects — send a direct update with your latest metrics to nudge them toward active interest.`
          : `Make sure your listing includes a strong company summary and clear funding ask. Investors save deals when the profile is compelling enough to return to later.`,
        totalActivity > 0
          ? `Your total of ${totalActivity} interactions is a signal of market interest. Convert this momentum by closing your document gaps — investors who are already watching you will upgrade to interest when your readiness score crosses 80.`
          : `Upload your pitch deck and financial model first. Investors rarely interact with listings that have an empty data room, even if the summary is strong.`,
      ],
    },
  };

  const cfg = open ? drawerConfig[open] : null;

  // -------------------------------------------------------------------------
  // Cards
  // -------------------------------------------------------------------------
  const cardClass =
    "group relative flex flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition hover:border-[#534AB7] hover:shadow-[0_0_0_3px_#EEEDFE] cursor-pointer";

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Capital readiness</h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              Operational indicators — not investment advice. Tap any card for details.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Readiness Score */}
          <button type="button" className={cardClass} onClick={() => setOpen("readiness")} aria-label="View readiness score details">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Readiness score</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-semibold text-slate-950">{readinessScore}/100</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{readinessDetail}</p>
              </div>
              <DonutChart pct={readinessScore / 100} color="#534AB7" />
            </div>
            <p className="mt-3 text-[10px] font-medium text-[#534AB7]">Tap to explore →</p>
          </button>

          {/* Raise Progress */}
          <button type="button" className={cardClass} onClick={() => setOpen("raise")} aria-label="View raise progress details">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Raise progress</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-semibold text-slate-950">{raiseProgress}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{companyStatus ?? "Pending"}</p>
              </div>
              <DonutChart pct={raiseProgress === "Published" ? Math.max(0.2, fillPct) : 0.1} color="#7F77DD" />
            </div>
            <p className="mt-3 text-[10px] font-medium text-[#534AB7]">Tap to explore →</p>
          </button>

          {/* Indicative Interest */}
          <button type="button" className={cardClass} onClick={() => setOpen("interest")} aria-label="View indicative interest details">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Indicative interest</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-semibold text-slate-950">
                  {formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                  From {pledgeSummary.investorCount} {pledgeSummary.investorCount === 1 ? "investor" : "investors"}
                </p>
              </div>
              <DonutChart pct={Math.max(0.05, fillPct)} color="#534AB7" />
            </div>
            <p className="mt-3 text-[10px] font-medium text-[#534AB7]">Tap to explore →</p>
          </button>

          {/* Investor Activity — two-segment donut */}
          <button type="button" className={cardClass} onClick={() => setOpen("activity")} aria-label="View investor activity details">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">Investor activity</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-semibold text-slate-950">{totalActivity}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">Interests, intros &amp; saved</p>
              </div>
              <DonutChart
                pct={totalActivity > 0 ? Math.max(0.05, interestCount / Math.max(1, totalActivity)) : 0.05}
                color="#534AB7"
                pct2={totalActivity > 0 ? Math.max(0.02, savedCount / Math.max(1, totalActivity)) : 0}
                color2="#AFA9EC"
              />
            </div>
            <p className="mt-3 text-[10px] font-medium text-[#534AB7]">Tap to explore →</p>
          </button>
        </div>
      </section>

      {/* Drawer overlay */}
      {open && cfg ? (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white px-5 pb-8 pt-4 shadow-2xl">
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-slate-200" />

            <div className="relative">
              <button
                type="button"
                onClick={close}
                className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close drawer"
              >
                ✕
              </button>

              <p className="pr-10 text-base font-semibold text-slate-950">{cfg.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{cfg.sub}</p>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {cfg.stats.map((s) => (
                  <StatBox key={s.label} label={s.label} value={s.value} />
                ))}
              </div>

              {/* Data breakdown */}
              <p className="mt-5 text-xs font-semibold text-slate-950">Data breakdown</p>
              <div className="mt-2">{cfg.breakdown}</div>

              {/* What this means */}
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
                <p className="text-xs leading-relaxed text-slate-600">{cfg.meaning}</p>
              </div>

              {/* AI advice */}
              <AdviceBox items={cfg.advice} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
