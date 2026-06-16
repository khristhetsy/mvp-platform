"use client";

import { useMemo, useState, useEffect } from "react";
import { FounderInvestorMatchCard } from "@/components/founder/FounderInvestorMatchCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ContentGrid, PageSection } from "@/components/ui/workspace-layout";
import {
  filterFounderMatchingRows,
  formatMatchingCheckSize,
  type FounderMatchingCenterSnapshot,
  type FounderMatchingCenterRow,
  type MatchingCenterFilters,
} from "@/lib/matching/matching-center";

const defaultFilters: MatchingCenterFilters = {
  industry: "",
  investorType: "",
  geography: "",
  minScore: 0,
  maxScore: 100,
};

type MetricDrawerKey = "strongMatches" | "approvedInvestors" | "profile";

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
// Metric card button — replicates OperationalMetric visually
// ---------------------------------------------------------------------------
function MatchMetricBtn({
  label,
  value,
  detail,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "indigo" | "violet" | "blue";
  onClick: () => void;
}) {
  const borderMap = { indigo: "border-l-indigo-500", violet: "border-l-violet-500", blue: "border-l-blue-500" };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left flex min-h-[8.75rem] flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99] border-l-4 ${borderMap[accent]}`}
    >
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</p>
        <div className="mt-1.5 flex flex-1 flex-col justify-between gap-2">
          <p className="truncate font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
          <p className="line-clamp-2 text-xs leading-5 text-slate-600">{detail}</p>
          <p className="text-[10px] font-semibold text-indigo-400 opacity-0 transition group-hover:opacity-100">
            View details →
          </p>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Metric drawer content (Strong matches / Approved investors / Your profile)
// ---------------------------------------------------------------------------
function MetricDrawerContent({
  drawerKey,
  snapshot,
  filteredCount,
  onClose,
}: {
  drawerKey: MetricDrawerKey;
  snapshot: FounderMatchingCenterSnapshot;
  filteredCount: number;
  onClose: () => void;
}) {
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

  const totalMatches = snapshot.matches.length;
  const strongPct = totalMatches > 0 ? Math.round((snapshot.strongMatchCount / totalMatches) * 100) : 0;

  // Score distribution
  const high = snapshot.matches.filter((m) => m.matchScore >= 70).length;
  const medium = snapshot.matches.filter((m) => m.matchScore >= 50 && m.matchScore < 70).length;
  const low = snapshot.matches.filter((m) => m.matchScore < 50).length;

  // Investor type distribution
  const typeMap: Record<string, number> = {};
  for (const m of snapshot.matches) {
    const t = m.investorType ?? "Unknown";
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }
  const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

  // ── Strong matches ─────────────────────────────────────────────────────────
  if (drawerKey === "strongMatches") {
    const topStrong = snapshot.matches
      .filter((m) => m.matchScore >= 70)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Strong matches</p>
            <p className="mt-0.5 text-xs text-slate-500">Approved investors scoring 70% or higher</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Strong matches" value={String(snapshot.strongMatchCount)} />
          <DStatBox label="Total investors" value={String(totalMatches)} />
          <DStatBox label="% strong" value={totalMatches > 0 ? `${strongPct}%` : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Top strong matches</p>
        <div className="mt-2">
          {topStrong.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">No strong matches yet.</p>
          ) : (
            topStrong.map((m) => (
              <BRow
                key={m.investorId}
                name={`${m.investorName}${m.investorType ? ` · ${m.investorType}` : ""}`}
                badge={`${m.matchScore}%`}
                variant={m.matchScore >= 85 ? "success" : "medium"}
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {snapshot.strongMatchCount === 0
              ? `No investors currently score 70%+ against your profile (${snapshot.industry ?? "industry not set"}, ${snapshot.companyGeography ?? "location not set"}). This typically means your company profile needs more detail, or your sector/stage isn't yet well-represented in the investor pool.`
              : `${snapshot.strongMatchCount} investor${snapshot.strongMatchCount === 1 ? "" : "s"} score 70%+ against your ${snapshot.industry ?? "profile"} — these are your highest-priority outreach targets. A strong match score means the investor's sector focus, geography, and check size all align well with your raise profile.`}
          </p>
        </div>

        <AdviceBox
          lines={[
            snapshot.strongMatchCount === 0
              ? "Improve your match count by completing your company profile: add your industry, funding stage, geography, and target check size. Each field narrows the matching algorithm to investors who are genuinely relevant."
              : `Prioritise your ${snapshot.strongMatchCount} strong match${snapshot.strongMatchCount === 1 ? "" : "es"} — contact each within the next 5 business days. A high match score signals genuine alignment; personalise your outreach by referencing specific reasons they're a fit.`,
            snapshot.strongMatchCount > 0 && topStrong[0]
              ? `Your top match (${topStrong[0].investorName}) scores ${topStrong[0].matchScore}% — ${topStrong[0].matchReasons.length > 0 ? `key fit signals: ${topStrong[0].matchReasons.slice(0, 2).join(", ")}` : "review their profile for alignment areas"}. This is your highest-priority connection.`
              : strongPct < 10 && totalMatches > 0
              ? `Only ${strongPct}% of investors are strong matches. Consider whether your industry tag, stage, and geography settings are accurate — even small profile improvements can double your strong match count.`
              : "Strong matches convert to meetings at 3–5× the rate of lower-scored contacts. Focus your limited outreach time here before moving to moderate matches.",
            snapshot.strongMatchCount > 3
              ? `With ${snapshot.strongMatchCount} strong matches, prioritise by match score and then by check size alignment. Investors with both a high match score and a check size that fits your target raise are your ideal first calls.`
              : "To expand your strong match pool, consider whether your raise stage or sector could be described more precisely. Matching improves significantly when company and investor profiles use consistent terminology.",
          ]}
        />
      </div>
    );
  }

  // ── Approved investors ────────────────────────────────────────────────────
  if (drawerKey === "approvedInvestors") {
    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Approved investors</p>
            <p className="mt-0.5 text-xs text-slate-500">The CapitalOS active matching pool</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Approved" value={String(snapshot.approvedInvestorCount)} />
          <DStatBox label="Strong matches" value={String(snapshot.strongMatchCount)} />
          <DStatBox label="Shown (filtered)" value={String(filteredCount)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Score distribution</p>
        <div className="mt-2">
          <BRow name="Strong (70%+)" badge={String(high)} variant={high > 0 ? "success" : "neutral"} />
          <BRow name="Moderate (50–69%)" badge={String(medium)} variant={medium > 0 ? "medium" : "neutral"} />
          <BRow name="Low (<50%)" badge={String(low)} variant="neutral" />
        </div>

        <p className="mt-4 text-xs font-semibold text-slate-900">Investor type breakdown</p>
        <div className="mt-2">
          {typeEntries.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">No type data available.</p>
          ) : (
            typeEntries.slice(0, 5).map(([type, count]) => (
              <BRow key={type} name={type} badge={String(count)} variant="neutral" />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {`The CapitalOS pool has ${snapshot.approvedInvestorCount} approved investor${snapshot.approvedInvestorCount === 1 ? "" : "s"} — these are verified, active investors with complete profiles. ${high > 0 ? `${high} of them score 70%+ against your company, giving you a concrete shortlist for outreach.` : "Currently none score 70%+ against your profile — complete your company profile to improve matching accuracy."}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            snapshot.approvedInvestorCount > 0
              ? `The ${snapshot.approvedInvestorCount}-investor pool is your addressable market on this platform. ${high > 0 ? `Start with your ${high} strong match${high === 1 ? "" : "es"} — these investors have explicitly stated preferences that align with your company.` : "No strong matches yet — your first step is completing your industry, stage, and geography in your company profile."}`
              : "The investor pool is still building. Complete your company profile now so you're ready to match when new investors join.",
            medium > 0
              ? `${medium} moderate match${medium === 1 ? "" : "es"} (50–69%) are worth approaching after exhausting your strong list. These investors partially fit your profile — personalise your outreach to specifically address the gaps in their criteria.`
              : high > 0
              ? "Focus exclusively on strong matches for now. Spreading outreach across low-fit investors reduces your conversion rate and dilutes the signal quality of your pipeline."
              : "Improve your match distribution by adding more detail to your profile: funding stage, revenue range, team size, and specific market differentiators all improve match precision.",
            totalMatches > 10
              ? `Use the score filter to segment your outreach. Approach 70%+ investors first this week, 50–69% next week. Staged outreach maintains momentum without overwhelming your follow-up capacity.`
              : "The platform pool will grow over time. In the meantime, supplement platform matching with warm introductions from your advisors and existing investors — referrals from trusted sources bypass the cold outreach conversion problem.",
          ]}
        />
      </div>
    );
  }

  // ── Your profile ──────────────────────────────────────────────────────────
  const avgScore =
    totalMatches > 0
      ? Math.round(snapshot.matches.reduce((s, m) => s + m.matchScore, 0) / totalMatches)
      : 0;

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">Your company profile</p>
          <p className="mt-0.5 text-xs text-slate-500">How your profile affects investor matching</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label="Industry" value={snapshot.industry ?? "Not set"} />
        <DStatBox label="Geography" value={snapshot.companyGeography ?? "Not set"} />
        <DStatBox label="Avg score" value={totalMatches > 0 ? `${avgScore}%` : "—"} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">Match profile details</p>
      <div className="mt-2">
        <BRow
          name="Industry / sector"
          badge={snapshot.industry ?? "Not set"}
          variant={snapshot.industry ? "success" : "critical"}
        />
        <BRow
          name="Company geography"
          badge={snapshot.companyGeography ?? "Not set"}
          variant={snapshot.companyGeography ? "success" : "high"}
        />
        <BRow
          name="Matches shown (current filter)"
          badge={String(filteredCount)}
          variant={filteredCount > 0 ? "medium" : "neutral"}
        />
        <BRow
          name="Strong matches (70%+)"
          badge={String(snapshot.strongMatchCount)}
          variant={snapshot.strongMatchCount > 0 ? "success" : "neutral"}
        />
        <BRow
          name="Average match score"
          badge={totalMatches > 0 ? `${avgScore}%` : "—"}
          variant={avgScore >= 60 ? "success" : avgScore >= 40 ? "medium" : "neutral"}
        />
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {!snapshot.industry && !snapshot.companyGeography
            ? "Your company profile is missing both industry and geography — these are the two most important matching signals. Without them, the algorithm cannot accurately rank investors by fit."
            : !snapshot.industry
            ? "Your industry is not set — this significantly reduces match accuracy. Add your sector in Company Settings to improve the quality of your investor recommendations."
            : !snapshot.companyGeography
            ? `Your geography isn't set. Many investors filter by region, so adding your location will improve both match quality and discovery by geography-focused investors.`
            : `Your profile is set to ${snapshot.industry} · ${snapshot.companyGeography}. The matching engine is scoring all ${totalMatches} approved investors against these signals. ${avgScore >= 60 ? "Good overall fit across the pool." : avgScore >= 40 ? "Moderate pool fit — completing more profile fields will improve your score distribution." : "Low average score suggests your current profile settings don't align strongly with most investors in the pool."}`}
        </p>
      </div>

      <AdviceBox
        lines={[
          !snapshot.industry
            ? "Set your industry in Company Settings immediately — it's the single highest-impact change you can make to improve match quality. Investors filter by sector first."
            : !snapshot.companyGeography
            ? "Add your company geography in Company Settings. Geography is a primary filter for most VCs and angels — without it, you're excluded from geography-based investor searches."
            : avgScore < 50
            ? `Your average match score of ${avgScore}% suggests a gap between your profile and the current investor pool. Review whether your industry tag (${snapshot.industry}) and stage description are accurate and specific enough.`
            : `Your average score of ${avgScore}% is solid. To push it higher, ensure your company profile includes: funding stage, current ARR/revenue, team size, and specific market differentiators.`,
          avgScore > 0
            ? `Focus outreach on investors where the match score is highest — don't spread effort evenly across the ${totalMatches} investors. The top ${Math.min(10, snapshot.strongMatchCount || Math.ceil(totalMatches * 0.1))} by score should get personalised, individual outreach.`
            : "Complete your profile first, then use the filters to narrow by investor type that matches your raise structure (e.g., VC for institutional rounds, Angel for early-stage).",
          snapshot.strongMatchCount > 0
            ? `${snapshot.strongMatchCount} strong match${snapshot.strongMatchCount === 1 ? "" : "es"} means the platform is working well for your profile. Update your profile after each fundraising milestone — new data room, completed product, revenue growth — to re-run the matching and surface new relevant investors.`
            : "Consider whether your profile description uses the same terminology as your target investors. If your sector is typically called 'fintech' but you've entered 'financial services', the semantic matching will miss relevant investors.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investor detail drawer
// ---------------------------------------------------------------------------
function InvestorDrawerContent({
  investor,
  snapshot,
  onClose,
}: {
  investor: FounderMatchingCenterRow;
  snapshot: FounderMatchingCenterSnapshot;
  onClose: () => void;
}) {
  const checkSizeLabel = formatMatchingCheckSize(investor.checkSizeMin, investor.checkSizeMax);
  const scoreTier =
    investor.matchScore >= 70 ? "strong" : investor.matchScore >= 50 ? "moderate" : "low";
  const scoreTierLabel =
    investor.matchScore >= 70 ? "Strong match" : investor.matchScore >= 50 ? "Moderate match" : "Low match";
  const rank =
    [...snapshot.matches].sort((a, b) => b.matchScore - a.matchScore).findIndex((m) => m.investorId === investor.investorId) + 1;

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{investor.investorName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[investor.investorType, investor.geographies.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "Platform investor"}
          </p>
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
        <DStatBox label="Match score" value={`${investor.matchScore}%`} />
        <DStatBox label="Rank" value={rank > 0 ? `#${rank}` : "—"} />
        <DStatBox label="Tier" value={scoreTierLabel} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">Fit analysis</p>
      <div className="mt-2">
        <BRow
          name="Match score"
          badge={`${investor.matchScore}%`}
          variant={investor.matchScore >= 70 ? "success" : investor.matchScore >= 50 ? "medium" : "neutral"}
        />
        <BRow
          name="Check size"
          badge={checkSizeLabel}
          variant={checkSizeLabel === "Not set" ? "neutral" : "medium"}
        />
        <BRow
          name="Geography coverage"
          badge={investor.geographies.length > 0 ? investor.geographies.slice(0, 2).join(", ") : "Not set"}
          variant={investor.geographies.length > 0 ? "medium" : "neutral"}
        />
        <BRow
          name="Investor type"
          badge={investor.investorType ?? "Not specified"}
          variant="neutral"
        />
      </div>

      {investor.matchReasons.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold text-slate-900">Fit signals ✓</p>
          <div className="mt-2">
            {investor.matchReasons.map((reason) => (
              <BRow key={reason} name={reason} badge="Match" variant="success" />
            ))}
          </div>
        </>
      )}

      {investor.missingFitReasons.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold text-slate-900">Gaps to address</p>
          <div className="mt-2">
            {investor.missingFitReasons.slice(0, 4).map((reason) => (
              <BRow key={reason} name={reason} badge="Gap" variant="high" />
            ))}
          </div>
        </>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {scoreTier === "strong"
            ? `${investor.investorName} is a strong match at ${investor.matchScore}% — ranked #${rank} across your full investor pool. ${investor.matchReasons.length > 0 ? `Key alignment: ${investor.matchReasons.slice(0, 2).join(", ")}.` : ""} ${investor.missingFitReasons.length > 0 ? `Remaining gap${investor.missingFitReasons.length > 1 ? "s" : ""}: ${investor.missingFitReasons[0]}.` : "No significant gaps identified."}`
            : scoreTier === "moderate"
            ? `${investor.investorName} is a moderate match at ${investor.matchScore}%. There's meaningful alignment but some gaps — ${investor.missingFitReasons.length > 0 ? `specifically: ${investor.missingFitReasons[0]}` : "review their specific investment criteria"}. Worth approaching, but personalise your pitch to directly address the fit gaps.`
            : `${investor.investorName} scores ${investor.matchScore}% — lower alignment with your current profile. ${investor.missingFitReasons.length > 0 ? `Main gaps: ${investor.missingFitReasons.slice(0, 2).join(", ")}.` : ""} Consider whether approaching them now is the best use of your outreach capacity.`}
        </p>
      </div>

      <AdviceBox
        lines={[
          scoreTier === "strong"
            ? `At ${investor.matchScore}% match, this investor is a genuine priority. Prepare a personalised intro referencing ${investor.matchReasons.length > 0 ? investor.matchReasons[0] : "your shared focus"} as the reason for reaching out — personalised outreach converts at 4–6× the rate of generic emails.`
            : scoreTier === "moderate"
            ? `A ${investor.matchScore}% match is worth pursuing after your strong-match list. Lead with your strongest fit signal${investor.matchReasons.length > 0 ? ` (${investor.matchReasons[0]})` : ""} and proactively address the gap${investor.missingFitReasons.length > 0 ? ` around ${investor.missingFitReasons[0]}` : ""} in your opening message.`
            : `At ${investor.matchScore}%, this investor has low alignment with your current profile. Unless you have a specific warm introduction, prioritise higher-scored investors first — cold outreach to low-fit investors has very low conversion rates.`,
          investor.missingFitReasons.length > 0
            ? `To improve fit with this investor specifically: address "${investor.missingFitReasons[0]}". This is the primary signal the algorithm identified as misaligned. Resolving this in your profile or pitch could meaningfully increase your effective score.`
            : investor.matchReasons.length > 0
            ? `Strong alignment on: ${investor.matchReasons.join(", ")}. Reference these specific signals explicitly in your outreach — "I noticed your focus on ${investor.matchReasons[0]}, which aligns with..." is a much stronger opener than a generic pitch.`
            : "Complete your company profile with more detail to generate specific match reasons — these signals are what personalised outreach is built from.",
          checkSizeLabel !== "Not set"
            ? `This investor's check range is ${checkSizeLabel}. Ensure your ask (or target check size) falls within this range — investors rarely make exceptions outside their stated parameters, and misaligned ask sizes are a common reason for early rejections.`
            : investor.geographies.length > 0
            ? `This investor covers: ${investor.geographies.join(", ")}. Confirm your company geography aligns before outreach — geography mismatch is one of the fastest ways to get an auto-decline.`
            : "This investor's check size and geography aren't fully specified — request their investment criteria before scheduling a call so you can confirm fit and tailor your pitch appropriately.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function FounderMatchingCenterPanel({ snapshot }: Readonly<{ snapshot: FounderMatchingCenterSnapshot }>) {
  const [filters, setFilters] = useState(defaultFilters);
  const [openMetric, setOpenMetric] = useState<MetricDrawerKey | null>(null);
  const [openInvestor, setOpenInvestor] = useState<FounderMatchingCenterRow | null>(null);

  const isAnyOpen = openMetric !== null || openInvestor !== null;

  useEffect(() => {
    document.body.style.overflow = isAnyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isAnyOpen]);

  const filteredMatches = useMemo(
    () => filterFounderMatchingRows(snapshot.matches, filters),
    [snapshot.matches, filters],
  );

  const closeAll = () => { setOpenMetric(null); setOpenInvestor(null); };

  return (
    <>
      {/* Metric cards */}
      <ContentGrid columns={3} className="mb-6">
        <MatchMetricBtn
          label="Strong matches"
          value={String(snapshot.strongMatchCount)}
          detail="Approved investors scoring 70% or higher"
          accent="indigo"
          onClick={() => setOpenMetric("strongMatches")}
        />
        <MatchMetricBtn
          label="Approved investors"
          value={String(snapshot.approvedInvestorCount)}
          detail="In the CapitalOS matching pool"
          accent="violet"
          onClick={() => setOpenMetric("approvedInvestors")}
        />
        <MatchMetricBtn
          label="Your profile"
          value={snapshot.industry ?? "Not set"}
          detail={[snapshot.companyGeography, `${filteredMatches.length} matches shown`].filter(Boolean).join(" · ")}
          accent="blue"
          onClick={() => setOpenMetric("profile")}
        />
      </ContentGrid>

      {/* Filters */}
      <WorkspacePanel title="Filters" subtitle="Industry, investor type, geography, and score range" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">
            Industry
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.industry}
              onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
            >
              <option value="">All sectors</option>
              {snapshot.filterOptions.industries.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Investor type
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.investorType}
              onChange={(event) => setFilters((current) => ({ ...current, investorType: event.target.value }))}
            >
              <option value="">All types</option>
              {snapshot.filterOptions.investorTypes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Geography
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.geography}
              onChange={(event) => setFilters((current) => ({ ...current, geography: event.target.value }))}
            >
              <option value="">All geographies</option>
              {snapshot.filterOptions.geographies.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-slate-600">
              Min score
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={filters.minScore}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, minScore: Number(event.target.value) || 0 }))
                }
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Max score
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={filters.maxScore}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, maxScore: Number(event.target.value) || 100 }))
                }
              />
            </label>
          </div>
        </div>
      </WorkspacePanel>

      {/* Investor match cards */}
      <PageSection
        title="Ranked investor matches"
        subtitle={`Sorted by CapitalOS match score for ${snapshot.companyName}`}
      >
        {filteredMatches.length === 0 ? (
          <p className="text-sm text-slate-600">
            No investor matches for the current filters. Adjust filters or complete your company profile to improve fit signals.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredMatches.map((row) => (
              <FounderInvestorMatchCard
                key={row.investorId}
                investorId={row.investorId}
                investorName={row.investorName}
                investorType={row.investorType}
                geographies={row.geographies}
                checkSizeLabel={formatMatchingCheckSize(row.checkSizeMin, row.checkSizeMax)}
                matchScore={row.matchScore}
                matchReasons={row.matchReasons}
                missingFitReasons={row.missingFitReasons}
                onClick={() => setOpenInvestor(row)}
              />
            ))}
          </div>
        )}
      </PageSection>

      {/* Centered 448 × 536 slide-up modal */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{
          opacity: isAnyOpen ? 1 : 0,
          pointerEvents: isAnyOpen ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.35)" }}
          onClick={closeAll}
        />
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: isAnyOpen ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {openMetric && (
            <MetricDrawerContent
              drawerKey={openMetric}
              snapshot={snapshot}
              filteredCount={filteredMatches.length}
              onClose={closeAll}
            />
          )}
          {openInvestor && (
            <InvestorDrawerContent
              investor={openInvestor}
              snapshot={snapshot}
              onClose={closeAll}
            />
          )}
        </div>
      </div>
    </>
  );
}
