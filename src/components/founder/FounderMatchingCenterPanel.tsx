"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  medium: "bg-[#EEEDFE] text-[#1A6CE4]",
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
  const t = useTranslations("founderCmp");
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
            <p className="text-base font-semibold text-slate-900">{t("strong_matches")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("approved_investors_scoring_70_or_higher")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("strong_matches")} value={String(snapshot.strongMatchCount)} />
          <DStatBox label={t("total_investors")} value={String(totalMatches)} />
          <DStatBox label={t("strong")} value={totalMatches > 0 ? `${strongPct}%` : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("top_strong_matches")}</p>
        <div className="mt-2">
          {topStrong.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">{t("no_strong_matches_yet")}</p>
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
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
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
            <p className="text-base font-semibold text-slate-900">{t("approved_investors")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("the_icapos_active_matching_pool")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("approved")} value={String(snapshot.approvedInvestorCount)} />
          <DStatBox label={t("strong_matches")} value={String(snapshot.strongMatchCount)} />
          <DStatBox label={t("shown_filtered")} value={String(filteredCount)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("score_distribution")}</p>
        <div className="mt-2">
          <BRow name="Strong (70%+)" badge={String(high)} variant={high > 0 ? "success" : "neutral"} />
          <BRow name="Moderate (50–69%)" badge={String(medium)} variant={medium > 0 ? "medium" : "neutral"} />
          <BRow name="Low (<50%)" badge={String(low)} variant="neutral" />
        </div>

        <p className="mt-4 text-xs font-semibold text-slate-900">{t("investor_type_breakdown")}</p>
        <div className="mt-2">
          {typeEntries.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">{t("no_type_data_available")}</p>
          ) : (
            typeEntries.slice(0, 5).map(([type, count]) => (
              <BRow key={type} name={type} badge={String(count)} variant="neutral" />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {`The iCapOS pool has ${snapshot.approvedInvestorCount} approved investor${snapshot.approvedInvestorCount === 1 ? "" : "s"} — these are verified, active investors with complete profiles. ${high > 0 ? `${high} of them score 70%+ against your company, giving you a concrete shortlist for outreach.` : "Currently none score 70%+ against your profile — complete your company profile to improve matching accuracy."}`}
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
          <p className="text-base font-semibold text-slate-900">{t("your_company_profile")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("how_your_profile_affects_investor_matching")}</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label={t("industry")} value={snapshot.industry ?? "Not set"} />
        <DStatBox label={t("geography")} value={snapshot.companyGeography ?? "Not set"} />
        <DStatBox label={t("avg_score")} value={totalMatches > 0 ? `${avgScore}%` : "—"} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">{t("match_profile_details")}</p>
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
        <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
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
// Outreach draft generation
// ---------------------------------------------------------------------------

function generateOutreachDraft(
  investor: FounderMatchingCenterRow,
  snapshot: FounderMatchingCenterSnapshot,
): { subject: string; body: string } {
  const name       = investor.investorName;
  const company    = snapshot.companyName;
  const industry   = snapshot.industry ?? "[your industry]";
  const topReason  = investor.matchReasons[0] ?? null;
  const topGap     = investor.missingFitReasons[0] ?? null;
  const iType      = (investor.investorType ?? "").toLowerCase();
  const isVC       = iType.includes("vc") || iType.includes("venture");
  const isAngel    = iType.includes("angel");

  // Subject line
  const subject = topReason
    ? `${company} — ${industry} · re: your focus on ${topReason.toLowerCase()}`
    : `${company} — ${industry} founder intro`;

  // Opening paragraph varies by investor type
  const opening = isVC
    ? `I came across your fund's focus on ${topReason ?? industry} and wanted to introduce ${company}.`
    : isAngel
    ? `I'm reaching out because ${topReason ? `your interest in ${topReason.toLowerCase()}` : "your investment background"} caught my attention.`
    : `I wanted to reach out based on ${topReason ? `your focus on ${topReason.toLowerCase()}` : "your investment thesis"}.`;

  // Fit signal paragraph
  const fitParagraph = topReason
    ? `Why I'm reaching out to you specifically: ${topReason}. ${
        topGap
          ? `I recognise there may be a question around ${topGap.toLowerCase()} — happy to address that directly.`
          : "I believe there's strong alignment between what you look for and what we're building."
      }`
    : `Based on our matching score, I believe there could be meaningful alignment between your investment focus and what we're building at ${company}.`;

  const geoNote =
    investor.geographies.length > 0
      ? `\n\nNote: we're based in ${snapshot.companyGeography ?? "[your location]"}, which I understand is within your investment geography (${investor.geographies.slice(0, 2).join(", ")}).`
      : "";

  const body = `Hi ${name},

${opening}

I'm the founder of ${company}, a ${industry} company helping [describe your target customer] [achieve a specific outcome]. We're currently raising [your round size] and speaking with a select group of investors.

${fitParagraph}${geoNote}

[One-line traction statement: e.g. "We've signed [X] customers / reached $[X]K ARR / completed [X] pilots."]

Would you be open to a 20-minute intro call? Happy to share our deck in advance.

Best,
[Your name]`;

  return { subject, body };
}

// ---------------------------------------------------------------------------
// Outreach kit component
// ---------------------------------------------------------------------------

function OutreachKit({
  investor,
  snapshot,
}: {
  investor: FounderMatchingCenterRow;
  snapshot: FounderMatchingCenterSnapshot;
}) {
  const t = useTranslations("founderCmp");
  const [open, setOpen]           = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody]     = useState(false);

  const { subject, body } = useMemo(
    () => generateOutreachDraft(investor, snapshot),
    [investor, snapshot],
  );

  const [editedBody, setEditedBody] = useState(body);

  function copy(text: string, type: "subject" | "body") {
    void navigator.clipboard.writeText(text).then(() => {
      if (type === "subject") {
        setCopiedSubject(true);
        setTimeout(() => setCopiedSubject(false), 2000);
      } else {
        setCopiedBody(true);
        setTimeout(() => setCopiedBody(false), 2000);
      }
    });
  }

  return (
    <div className="mt-4">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition"
        style={{ background: open ? "#EEEDFE" : "#f8f7fd", border: "1px solid #e0e7ff" }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#2E78F5" strokeWidth="2" />
            <polyline points="22,6 12,13 2,6" stroke="#2E78F5" strokeWidth="2" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "#2E78F5" }}>{t("outreach_kit")}</span>
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "#2E78F5", color: "white" }}>{t("new")}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="#2E78F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Body */}
      {open ? (
        <div
          className="mt-2 rounded-xl border p-4"
          style={{ borderColor: "#e0e7ff", background: "#fafaff", animation: "fadeUp .2s ease both" }}
        >
          <p className="mb-3 text-[10px] text-slate-400">
            Personalised draft based on this investor&apos;s profile. Edit the{" "}
            <span className="font-semibold text-slate-600">[brackets]</span> before sending.
          </p>

          {/* Subject line */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("subject_line")}</p>
              <button
                type="button"
                onClick={() => copy(subject, "subject")}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition"
                style={{ background: copiedSubject ? "#EAF3DE" : "#EEEDFE", color: copiedSubject ? "#1E6D3C" : "#2E78F5" }}
              >
                {copiedSubject ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
              {subject}
            </p>
          </div>

          {/* Draft body */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("draft_message")}</p>
              <button
                type="button"
                onClick={() => copy(editedBody, "body")}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition"
                style={{ background: copiedBody ? "#EAF3DE" : "#EEEDFE", color: copiedBody ? "#1E6D3C" : "#2E78F5" }}
              >
                {copiedBody ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <textarea
              rows={10}
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full resize-none rounded-lg bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 ring-1 ring-slate-200"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting prep kit
// ---------------------------------------------------------------------------

function generateMeetingPrep(
  investor: FounderMatchingCenterRow,
  snapshot: FounderMatchingCenterSnapshot,
): { likelyQuestions: string[]; talkingPoints: string[]; watchOuts: string[] } {
  const iType  = (investor.investorType ?? "").toLowerCase();
  const isVC   = iType.includes("vc") || iType.includes("venture");
  const isAngel = iType.includes("angel");

  // Likely questions — gap-driven first, then standard by type
  const likelyQuestions: string[] = [];

  for (const gap of investor.missingFitReasons.slice(0, 3)) {
    likelyQuestions.push(`How do you address the question around ${gap.toLowerCase()}?`);
  }

  if (isVC) {
    likelyQuestions.push(
      "What does your path to $100M ARR look like?",
      "How defensible is your competitive moat?",
      "What are your unit economics and CAC:LTV ratio?",
    );
  } else if (isAngel) {
    likelyQuestions.push(
      "Why are you the right team to solve this problem?",
      "What traction have you seen so far?",
      "How much runway does this raise give you?",
    );
  } else {
    likelyQuestions.push(
      "How does your business fit into our existing portfolio?",
      "What does co-investment look like — do you take board seats?",
      "What does your governance structure look like?",
    );
  }

  // Talking points — match-reason driven
  const talkingPoints: string[] = [];

  for (const reason of investor.matchReasons.slice(0, 3)) {
    talkingPoints.push(`Lead with: "${reason}" — this is a direct fit signal for this investor.`);
  }

  if (investor.checkSizeMin !== null || investor.checkSizeMax !== null) {
    const range = formatMatchingCheckSize(investor.checkSizeMin, investor.checkSizeMax);
    talkingPoints.push(`Confirm your ask aligns with their check range (${range}) — do this early to avoid wasted time.`);
  }

  if (snapshot.companyGeography) {
    talkingPoints.push(`Mention your geography (${snapshot.companyGeography}) early — they invest in ${investor.geographies.slice(0, 2).join(", ") || "your region"}.`);
  }

  talkingPoints.push(
    "Close with a specific next step: share your data room, send deck, or schedule a follow-up — ambiguous endings lose deals.",
  );

  // Watch-outs
  const watchOuts: string[] = [];

  for (const gap of investor.missingFitReasons.slice(0, 2)) {
    watchOuts.push(`Be ready to address "${gap}" proactively — don't wait for them to raise it.`);
  }

  if (investor.matchScore < 60) {
    watchOuts.push("Low match score — tailor your pitch heavily to their stated focus, or reconsider whether this meeting is the best use of your time.");
  }

  watchOuts.push("Avoid generic intros — reference a specific portfolio company or thesis point to show you've done your homework.");

  return {
    likelyQuestions: likelyQuestions.slice(0, 5),
    talkingPoints: talkingPoints.slice(0, 4),
    watchOuts: watchOuts.slice(0, 3),
  };
}

function MeetingPrepKit({
  investor,
  snapshot,
}: {
  investor: FounderMatchingCenterRow;
  snapshot: FounderMatchingCenterSnapshot;
}) {
  const t = useTranslations("founderCmp");
  const [open, setOpen] = useState(false);
  const prep = useMemo(() => generateMeetingPrep(investor, snapshot), [investor, snapshot]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition"
        style={{ background: open ? "#F0FDF4" : "#f8fdf9", border: "1px solid #bbf7d0" }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>{t("meeting_prep")}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="mt-2 space-y-4 rounded-xl border p-4"
          style={{ borderColor: "#bbf7d0", background: "#f0fdf4", animation: "fadeUp .2s ease both" }}
        >
          <p className="text-[10px] text-slate-400">
            Personalised briefing for your meeting with {investor.investorName}.
          </p>

          {/* Likely questions */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{t("likely_questions")}</p>
            <div className="space-y-1.5">
              {prep.likelyQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500">?</span>
                  <p className="text-xs leading-relaxed text-slate-700">{q}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Talking points */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{t("talking_points")}</p>
            <div className="space-y-1.5">
              {prep.talkingPoints.map((p, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: "#16a34a" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-slate-700">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Watch-outs */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{t("watch_outs")}</p>
            <div className="space-y-1.5">
              {prep.watchOuts.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs leading-relaxed text-amber-800">{w}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
  const t = useTranslations("founderCmp");
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
        <DStatBox label={t("match_score")} value={`${investor.matchScore}%`} />
        <DStatBox label={t("rank")} value={rank > 0 ? `#${rank}` : "—"} />
        <DStatBox label={t("tier")} value={scoreTierLabel} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">{t("fit_analysis")}</p>
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
          <p className="mt-4 text-xs font-semibold text-slate-900">{t("fit_signals")}</p>
          <div className="mt-2">
            {investor.matchReasons.map((reason) => (
              <BRow key={reason} name={reason} badge="Match" variant="success" />
            ))}
          </div>
        </>
      )}

      {investor.missingFitReasons.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold text-slate-900">{t("gaps_to_address")}</p>
          <div className="mt-2">
            {investor.missingFitReasons.slice(0, 4).map((reason) => (
              <BRow key={reason} name={reason} badge="Gap" variant="high" />
            ))}
          </div>
        </>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
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

      <OutreachKit investor={investor} snapshot={snapshot} />
      <MeetingPrepKit investor={investor} snapshot={snapshot} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function FounderMatchingCenterPanel({ snapshot }: Readonly<{ snapshot: FounderMatchingCenterSnapshot }>) {
  const t = useTranslations("founderCmp");
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
          label={t("strong_matches")}
          value={String(snapshot.strongMatchCount)}
          detail="Approved investors scoring 70% or higher"
          accent="indigo"
          onClick={() => setOpenMetric("strongMatches")}
        />
        <MatchMetricBtn
          label={t("approved_investors")}
          value={String(snapshot.approvedInvestorCount)}
          detail="In the iCapOS matching pool"
          accent="violet"
          onClick={() => setOpenMetric("approvedInvestors")}
        />
        <MatchMetricBtn
          label={t("your_profile")}
          value={snapshot.industry ?? "Not set"}
          detail={[snapshot.companyGeography, `${filteredMatches.length} matches shown`].filter(Boolean).join(" · ")}
          accent="blue"
          onClick={() => setOpenMetric("profile")}
        />
      </ContentGrid>

      {/* Filters */}
      <WorkspacePanel title={t("filters")} subtitle={t("industry_investor_type_geography_and_score_r")} className="mb-6">
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
        title={t("ranked_investor_matches")}
        subtitle={`Sorted by iCapOS match score for ${snapshot.companyName}`}
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
