// Per-item diagnosis for the stage menu mirror: what is wrong, what is missing,
// and how to fix it — instead of a bare "Attention" chip.
//
// The status chips alone were unactionable. "Capital Readiness Rating ·
// Attention" is a boolean over `readinessQualified`; it never said the score was
// 34, that the gate is 65, or which dimension was short — all of which the CRR
// engine already knows. This turns the signals the platform holds into three
// blocks staff can act on, and says plainly when an item has no signal at all
// rather than inventing one.
//
// Server only — reads the engine through crrFor.

import { crrFor, type Crr } from "@/lib/crr/crr-for";
import { allGaps } from "@/lib/crr/dimension-detail";
import { loadActiveSet } from "@/lib/crr/weight-sets-db";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requiredDocumentTypes } from "@/lib/documents/required-types";
import { documentTypeCode } from "@/lib/data/founder-readiness";
import type { StoredFactor } from "@/lib/crr/weight-sets";
import type { FactorKey } from "@/lib/ai/readiness-scoring";
import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";

/** One line in "what's missing" — a label and the size of the gap. */
export type MissingRow = {
  label: string;
  /** Rendered on the right: "−23", "absent", "14 mo old". */
  note: string;
  /** Present when the row is a measured 0–max quantity, so the UI can draw a bar. */
  bar?: { value: number; max: number };
};

/** One numbered step in "how to solve". */
export type FixStep = {
  text: string;
  /** Who does it / where — the small grey line. */
  who?: string;
  /** "+9" for CRR point gains, "gate" when the step clears the stage gate. */
  impact?: string;
};

export type ItemDiagnosis = {
  /** Short status line shown on the row itself, next to the chip. */
  headline: string;
  /** Whether the platform actually measures this item. */
  measured: boolean;
  problem: string[];
  missing: MissingRow[];
  fixes: FixStep[];
  /** Where the numbers came from — a claim without provenance is not evidence. */
  source: string;
  /** Drawn in the problem block when the item is the CRR itself. */
  ring?: { score: number; gate: number; label: string; band: string | null };
};

/** How a whole stage stands — decides the banner and what the email should say. */
export type StageSituation = "blocking" | "cleared" | "locked-near" | "locked-far";

// Same alias map the founder checklist uses — the upload API and the legacy
// form wrote different codes for the same document.
const DOC_CODE_ALIASES: Record<string, string[]> = {
  FINANCIAL_MODEL: ["FINANCIAL_STATEMENTS", "FINANCIALS"],
  LEGAL_DOCUMENTS: ["LEGAL_DOCUMENT"],
};

const DIM_LABEL: Record<string, string> = {
  team: "Team",
  market: "Market",
  traction: "Traction",
  financials: "Financials",
  narrative: "Narrative",
};

/** An item with no wired signal. Honest beats decorative. */
function unmeasured(wouldRead: string, query: string): ItemDiagnosis {
  return {
    headline: "not measured",
    measured: false,
    problem: [
      "Nothing in the platform reads this item's state, so any status here would be invented.",
      "It is shown as unknown rather than guessed.",
    ],
    missing: [],
    fixes: [{ text: query, who: "To measure it" }, { text: `It would then read: ${wouldRead}`, who: "Once wired" }],
    source: "No signal wired",
  };
}

/** The CRR item — the engine already holds everything this needs. */
function crrDiagnosis(crr: Crr, gapLines: MissingRow[], fixes: FixStep[]): ItemDiagnosis {
  if (crr.score === null) {
    return {
      headline: "never scored",
      measured: true,
      problem: ["This company has no score row — the engine has never run for it."],
      missing: [],
      fixes: [{ text: "Run a score from the readiness wizard, or re-score from the CRR admin.", who: "Staff or founder" }],
      source: "company_readiness_scores — no rows",
    };
  }

  const short = crr.pointsToGate;
  const covered = fixes.reduce((sum, f) => sum + (Number(f.impact?.replace("+", "")) || 0), 0);

  const problem = [
    `Scores ${crr.score}/100 on the ${crr.profileLabel} profile. Outreach unlocks at ${crr.gate}.` +
      (crr.band ? ` Band ${crr.band}.` : ""),
  ];
  if (crr.isOverridden) problem.push("This score is an admin override, not the engine's own figure.");
  if (short > 0 && covered > 0) {
    problem.push(
      covered >= short
        ? `The fixes listed are worth +${covered} — enough to clear the gate.`
        : `The fixes listed are worth +${covered}, which reaches ${crr.score + covered} — still ${short - covered} short.`,
    );
  }

  return {
    headline: short > 0 ? `CRR ${crr.score}/100 · gate ${crr.gate} · ${short} short` : `CRR ${crr.score}/100 · gate cleared`,
    measured: true,
    problem,
    missing: gapLines,
    fixes,
    source:
      `CRR engine${crr.version ? ` · ${crr.version}` : ""}` +
      `${crr.scoredAt ? ` · scored ${new Date(crr.scoredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}` +
      ` · ${crr.profileLabel} profile from the company's funding stage`,
    ring: { score: crr.score, gate: crr.gate, label: crr.profileLabel, band: crr.band },
  };
}

/**
 * The documents item — measured against the canonical required list.
 *
 * `present` holds the UPPER_SNAKE codes actually stored on the rows
 * (PITCH_DECK, FINANCIAL_STATEMENTS…), never the human labels. Comparing the
 * labels directly reported "0 of 3 core" for a company with every document
 * uploaded, which then sat next to a green Done chip.
 */
function documentsDiagnosis(present: Set<string>, coreNeeded: string[]): ItemDiagnosis {
  const has = (label: string) => {
    const code = documentTypeCode(label);
    return present.has(code) || (DOC_CODE_ALIASES[code] ?? []).some((a) => present.has(a));
  };
  const missingCore = coreNeeded.filter((t) => !has(t));
  const missingAll = requiredDocumentTypes.filter((t) => !has(t));
  const haveCore = coreNeeded.length - missingCore.length;

  const missing: MissingRow[] = [
    { label: "Core (gate)", note: `${haveCore}/${coreNeeded.length}`, bar: { value: haveCore, max: coreNeeded.length } },
    {
      label: "Full package",
      note: `${requiredDocumentTypes.length - missingAll.length}/${requiredDocumentTypes.length}`,
      bar: { value: requiredDocumentTypes.length - missingAll.length, max: requiredDocumentTypes.length },
    },
    ...missingAll.map((t) => ({
      label: coreNeeded.includes(t) ? `${t} · core` : t,
      note: "absent",
    })),
  ];

  const fixes: FixStep[] = missingCore.length
    ? [
        { text: `Request ${missingCore.join(" and ")} — the stage gate needs ${missingCore.length === 1 ? "this" : "these"}.`, who: "Templated request", impact: "gate" },
        { text: "Send the template if the founder has not built one.", who: "Founder" },
        ...(missingAll.length > missingCore.length
          ? [{ text: `The other ${missingAll.length - missingCore.length} are not gate items — chase after the stage clears.`, who: "Not blocking" }]
          : []),
      ]
    : [{ text: "All core documents are in. Remaining types strengthen diligence but do not gate the stage.", who: "Not blocking" }];

  return {
    headline: `${haveCore} of ${coreNeeded.length} core · ${requiredDocumentTypes.length - missingAll.length} of ${requiredDocumentTypes.length} full package`,
    measured: true,
    problem: missingCore.length
      ? [`The gate needs all ${coreNeeded.length} core documents. Missing: ${missingCore.join(", ")}.`]
      : ["All core documents are uploaded; this item is not blocking."],
    missing,
    fixes,
    source: "documents table vs requiredDocumentTypes",
  };
}

/** Items whose signal is a plain journey boolean. */
function conditionDiagnosis(
  met: boolean,
  when: { problem: string; missing: MissingRow[]; fixes: FixStep[]; headline: string },
  source: string,
): ItemDiagnosis {
  if (met) {
    return {
      headline: "passing",
      measured: true,
      problem: ["This gate is satisfied."],
      missing: [],
      fixes: [{ text: "No action needed.", who: "Cleared" }],
      source,
    };
  }
  return { headline: when.headline, measured: true, problem: [when.problem], missing: when.missing, fixes: when.fixes, source };
}

/** Everything one stage tab needs: the drawers, the banner, and the email's facts. */
export type StageDiagnosis = {
  byHref: Record<string, ItemDiagnosis>;
  situation: StageSituation;
  summary: string;
  /** Flattened findings the reach-out draft is written from. */
  facts: string[];
};

/**
 * Diagnoses for every item in one stage, keyed by the founder route.
 * Routes absent from the map render with no drawer.
 */
export async function diagnoseStage(
  companyId: string | null,
  journey: FounderJourneyState,
  stage: JourneyStage,
): Promise<{ byHref: Record<string, ItemDiagnosis>; situation: StageSituation; summary: string; crr: Crr | null }> {
  const c = journey.conditions;
  const crr = companyId ? await crrFor(companyId) : null;
  const byHref: Record<string, ItemDiagnosis> = {};

  // --- CRR gaps, ranked by the points going unearned at this company's stage ---
  let gapLines: MissingRow[] = [];
  let crrFixes: FixStep[] = [];
  if (crr && crr.score !== null && companyId) {
    gapLines = crr.dimensions
      .map((d): MissingRow & { bar: { value: number; max: number } } => ({
        label: d.label,
        note: d.headroom > 0 ? `−${d.headroom}` : "0",
        bar: { value: Math.round(d.contributes), max: Math.round(d.weight) },
      }))
      // Worst first, measured in points of this company's score going unearned.
      .sort((a, b) => b.bar.max - b.bar.value - (a.bar.max - a.bar.value));

    try {
      const set = await loadActiveSet(createServiceRoleClient());
      const stored = crr.factorScores as Partial<Record<FactorKey, StoredFactor>>;
      crrFixes = allGaps(stored, set, crr.profile)
        .filter((g) => g.lost > 0)
        .slice(0, 4)
        .map((g) => ({
          text: `Improve ${g.label} — scoring ${g.pts} of ${g.max} at ${crr.profileLabel}.`,
          who: DIM_LABEL[String(g.key)] ? undefined : "Founder",
          impact: `+${Math.round(g.lost)}`,
        }));
    } catch {
      crrFixes = [];
    }
  }

  // --- documents ---
  const coreNeeded = ["Pitch deck", "Financial model", "Cap table"];
  let docDiag: ItemDiagnosis | null = null;
  if (companyId) {
    try {
      const db = createServiceRoleClient();
      const { data } = await db.from("documents").select("document_type, status").eq("company_id", companyId);
      const present = new Set(
        ((data ?? []) as Array<{ document_type?: string | null; status?: string | null }>)
          // Archived files don't satisfy a slot — same rule as buildDocumentChecklist.
          .filter((d) => (d.status ?? "").toLowerCase() !== "archived")
          .map((d) => (d.document_type ?? "").toUpperCase().trim())
          .filter(Boolean),
      );
      docDiag = documentsDiagnosis(present, coreNeeded);
    } catch {
      docDiag = null;
    }
  }

  if (stage === "initialize") {
    byHref["/founder/settings"] = conditionDiagnosis(
      c.onboardingComplete,
      {
        headline: "profile incomplete",
        problem: "Onboarding is not complete, so the company is not yet pinned to a scoring profile.",
        missing: [{ label: "Profile completeness", note: "incomplete" }],
        fixes: [{ text: "Walk the founder through the remaining profile fields.", who: "Founder" }],
      },
      "journey condition onboardingComplete",
    );
    if (c.onboardingComplete) {
      byHref["/founder/settings"].fixes = [
        {
          text: "No action. Worth knowing: the funding stage field set here selects the factor points the whole score is measured against — confirm it matches the round they are actually raising.",
          who: "Changing it re-scores the company",
        },
      ];
    }
    byHref["/founder/journey"] = unmeasured("nothing — this is a view, not a deliverable", "Candidate to drop from the gate list.");
    byHref["/founder/actions"] = unmeasured("open actions, age of the oldest", "Count rows in the next-best-actions table for this founder.");
    byHref["/founder/preview"] = unmeasured("published? last viewed?", "Read the one-pager's published flag and view count.");
  }

  if (stage === "qualify") {
    if (crr) byHref["/founder/readiness/wizard"] = crrDiagnosis(crr, gapLines, crrFixes);
    if (docDiag) byHref["/founder/documents"] = docDiag;
    byHref["/founder/readiness"] = unmeasured(
      "answered vs total checklist items",
      "Count answered rows against the checklist definition for this company.",
    );
    byHref["/founder/readiness/data-room"] = unmeasured(
      "folders populated, which are empty",
      "Count data-room folders and files against the nine required types — the same join Documents already does.",
    );
    byHref["/founder/business-plan"] = unmeasured("document present? last edited?", "Read the business-plan record for this company.");
    byHref["/founder/pitch-deck"] = unmeasured("uploaded? slide count? AI quality score?", "Read the pitch-deck document and its ai_summary.");
    byHref["/founder/financial-model"] = unmeasured("model present? projection years?", "Read the financial-model record for this company.");
    byHref["/founder/cap-table"] = unmeasured("file present? parsed?", "Read the cap-table document and whether its contents were parsed.");
    byHref["/founder/valuation"] = unmeasured("valuation run? method used?", "Read saved valuations for this company's org.");
  }

  if (stage === "deploy") {
    const unlocked = crr?.outreachUnlocked ?? false;
    const short = crr?.pointsToGate ?? crr?.gate ?? 0;
    // The requirement this stage runs on. Same diagnosis the Preparation row
    // shows — one reader, so the two tabs can never disagree about the number.
    if (crr) byHref["/founder/readiness/wizard"] = crrDiagnosis(crr, gapLines, crrFixes);
    byHref["/founder/deploy"] = {
      headline: unlocked ? "outreach unlocked" : `blocked — ${short} points to the gate`,
      measured: true,
      problem: unlocked
        ? ["Outreach is unlocked; sequences can enrol."]
        : [`Sequences cannot enrol: the engine flag outreach_unlocked is false at ${crr?.score ?? 0}/${crr?.gate ?? 65}.`],
      missing: unlocked ? [] : [{ label: "Points to the gate", note: String(short) }],
      fixes: unlocked
        ? [{ text: "Nothing blocking. Enrol the founder in a sequence when they are ready.", who: "Staff" }]
        : [
            {
              text: "Nothing to do in this stage. Work the Preparation list — this unlocks on its own the moment the score crosses the gate, with no staff action.",
              who: "Automatic",
            },
          ],
      source: "CRR engine gate (OUTREACH_GATE) — the same flag the founder page reads",
    };
    byHref["/founder/investor-pipeline"] = conditionDiagnosis(
      c.hasInvestorInterest,
      {
        headline: "no investor has reached Interested",
        problem: "No investor in the pipeline has reached the Interested stage, which is what Closing needs.",
        missing: [{ label: "Interested investors", note: "0" }],
        fixes: [{ text: "Outreach has to run first; this follows from it.", who: "Downstream" }],
      },
      "journey condition hasInvestorInterest",
    );
    // Browsing is open at any CRR. What the gate holds is "Request introduction" —
    // a brokered intro goes out under the iCapOS name, so it waits for the rating.
    const browseOnly = (what: string): ItemDiagnosis => ({
      headline: unlocked ? "open" : `browse only — ${short} points to the gate`,
      measured: true,
      problem: unlocked
        ? [`${what} is fully open; introductions can be requested.`]
        : [
            `${what} is browsable, but "Request introduction" is held: the engine flag outreach_unlocked is false at ${crr?.score ?? 0}/${crr?.gate ?? 65}.`,
            "Looking costs nothing. An introduction carries the iCapOS name, which is what the rating gates.",
          ],
      missing: unlocked ? [] : [{ label: "Points to the gate", note: String(short) }],
      fixes: unlocked
        ? [{ text: "Nothing blocking.", who: "Staff" }]
        : [
            {
              text: "Nothing to do here. The founder can keep reviewing matches; the request button enables itself when the score crosses the gate.",
              who: "Automatic",
            },
          ],
      source: "CRR engine gate (OUTREACH_GATE) — the same flag Automated outreach reads",
    });
    byHref["/founder/matches"] = browseOnly("Investor matches");
    byHref["/founder/matching"] = browseOnly("The Matching Center");
    byHref["/founder/events/present"] = unmeasured("applied? presented?", "Read event applications for this company.");
    byHref["/founder/private-market"] = unmeasured("campaign published?", "Read the marketplace campaign's published flag.");
  }

  if (stage === "optimize") {
    byHref["/founder/deal-room"] = conditionDiagnosis(
      c.hasDealRoom,
      {
        headline: "none open — the gate for this stage",
        problem:
          "No deal room exists. It gates this whole stage and cannot be created until an investor reaches Interested.",
        missing: [
          { label: "Interested investors", note: c.hasInvestorInterest ? "yes" : "0" },
          { label: "Gates upstream", note: c.hasInvestorInterest ? "1" : "3" },
        ],
        fixes: [
          {
            text: "No direct action exists. The chain is CRR gate → outreach → one interested investor → deal room. Everything useful sits in Preparation.",
            who: "Three gates back",
          },
        ],
      },
      "journey condition hasDealRoom",
    );
    byHref["/founder/offering-type"] = unmeasured("type chosen?", "Read offering_type on the company.");
    byHref["/founder/spvs"] = unmeasured("SPV count and phase", "Count SPVs and their lifecycle phase.");
    byHref["/founder/capital-raise"] = unmeasured("target vs committed", "Read the raise target and pledge total.");
    byHref["/founder/investor-update"] = unmeasured("last update sent", "Read the newest published company update.");
    byHref["/founder/milestones"] = unmeasured("next milestone, overdue count", "Read milestones for this company.");
    byHref["/founder/analytics"] = unmeasured("nothing — a view, not a deliverable", "Candidate to drop from the gate list.");
  }

  const { situation, summary } = classifyStage(byHref, journey, stage, crr);
  return { byHref, situation, summary, crr };
}

/**
 * All four stages at once, ready to hand to the client workspace.
 *
 * The findings are flattened here rather than in the component: the reach-out
 * draft is only as good as what it is given, and item labels alone are what made
 * the old emails say "these are still pending" and nothing more.
 */
export async function diagnoseAllStages(
  companyId: string | null,
  journey: FounderJourneyState,
): Promise<Record<JourneyStage, StageDiagnosis>> {
  const stages: JourneyStage[] = ["initialize", "qualify", "deploy", "optimize"];
  const results = await Promise.all(stages.map((s) => diagnoseStage(companyId, journey, s)));

  const out = {} as Record<JourneyStage, StageDiagnosis>;
  stages.forEach((stage, i) => {
    const { byHref, situation, summary } = results[i];
    const facts = Object.entries(byHref).flatMap(([, d]) => {
      if (!d.measured) return [];
      return [
        `${d.headline}. ${d.problem.join(" ")}`,
        ...d.missing.filter((m) => m.note !== "0" && m.note !== "yes").map((m) => `${m.label}: ${m.note}`),
        ...d.fixes.filter((f) => f.impact).map((f) => `Fix (${f.impact}): ${f.text}`),
      ];
    });
    out[stage] = { byHref, situation, summary, facts };
  });
  return out;
}

/**
 * How the stage stands, and the one-paragraph version for the banner.
 * The situation is what lets the reach-out email say something true: a cleared
 * stage and a stage locked three gates back need very different letters.
 */
export function classifyStage(
  byHref: Record<string, ItemDiagnosis>,
  journey: FounderJourneyState,
  stage: JourneyStage,
  crr: Crr | null,
): { situation: StageSituation; summary: string } {
  const order: JourneyStage[] = ["initialize", "qualify", "deploy", "optimize"];
  const idx = order.indexOf(stage);
  const reached = idx <= journey.stageIndex;
  const short = crr?.pointsToGate ?? null;

  if (!reached) {
    const far = idx - journey.stageIndex >= 2;
    if (far) {
      return {
        situation: "locked-far",
        summary:
          `Unlocks once the earlier stages clear — ${idx - journey.stageIndex} gates back. ` +
          `Nothing here is actionable; work the current stage.`,
      };
    }
    return {
      situation: "locked-near",
      summary:
        crr && crr.score !== null
          ? `Unlocks once the current stage clears. Outreach opens at CRR ${crr.gate} and this company is at ${crr.score} — ${short} short.`
          : "Unlocks once the current stage clears. Items shown for visibility.",
    };
  }

  const blocking = Object.entries(byHref).filter(([, d]) => d.measured && d.problem.length > 0 && !/satisfied|not blocking|unlocked/i.test(d.problem[0]));
  if (blocking.length === 0) {
    return {
      situation: "cleared",
      summary: journey.pendingApproval
        ? "All tracked items are met — the founder is awaiting your stage approval."
        : "On track — no blocking items measured in this stage.",
    };
  }
  return { situation: "blocking", summary: blocking.map(([, d]) => d.problem[0]).join(" ") };
}
