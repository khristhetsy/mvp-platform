// The founder-facing "path to the next stage" for one stage guide, built on the
// real advancement gate (evaluateFounderJourney). This is what reconciles the
// guide vocabulary (onboarding/preparation/marketing/closing) with the engine
// vocabulary (initialize/qualify/deploy/optimize) and turns the gate into plain
// steps — so a founder is never told "98% complete" while actually blocked.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { STAGE_SLUGS, type StageSlug } from "@/lib/founder/stage-guides";
import { requiredDocumentTypes } from "@/lib/documents/required-types";
import { outreachBlocker, type CrrSummary } from "@/lib/crr/blocker";

export type GateItemState = "done" | "active" | "todo";
export type GateCta = { label: string; href: string };
export type GateItem = { label: string; detail?: string; state: GateItemState; cta?: GateCta };
export type GateReview = { status: "pending" | "approved" | "rejected"; feedback?: string | null };

export type StageGate = {
  slug: StageSlug;
  stageNumber: number;
  stageName: string;
  nextStageName: string | null;
  /** guide stage vs the founder's actual stage */
  relation: "complete" | "current" | "locked";
  headline: string;
  /** short line for complete/locked states */
  summary?: string;
  /** the checklist, for the current stage */
  items: GateItem[];
  /** the single next action */
  primaryCta?: GateCta;
  /** admin review status while in Preparation */
  review?: GateReview;
};

const STAGE_NAMES: Record<StageSlug, string> = {
  onboarding: "Onboarding",
  preparation: "Preparation",
  marketing: "Marketing",
  closing: "Closing",
};

export type JourneyStageSummary = {
  slug: StageSlug;
  stageNumber: number;
  name: string;
  relation: "complete" | "current" | "locked";
  line: string;
};
/** The single next action for the founder — rule-based and gate/entitlement-aware,
 *  so its CTA never sends a founder to a page they can't open. */
export type FounderNextAction = {
  title: string;
  description?: string;
  cta: GateCta;
  secondaryCta?: GateCta;
};

export type JourneyOverview = {
  stages: JourneyStageSummary[];
  currentSlug: StageSlug | null;
  nextAction: FounderNextAction | null;
};

/** Compact four-stage summary for the dashboard — one evaluate call, one line
 *  of status per stage, plus the gate-aware next action. Same source of truth as
 *  the per-guide gate panel. `outreachReady` gates the Marketing action so a
 *  founder is only pointed at distribution once they're actually eligible. */
export async function getJourneyOverview(
  supabase: SupabaseClient<Database>,
  profileId: string,
  opts?: { outreachReady?: boolean; crr?: CrrSummary | null },
): Promise<JourneyOverview> {
  const state = await evaluateFounderJourney(supabase, profileId);
  const founderIdx = state.stageIndex;
  const c = state.conditions;

  const stages: JourneyStageSummary[] = STAGE_SLUGS.map((slug, idx) => {
    const relation: JourneyStageSummary["relation"] = idx < founderIdx ? "complete" : idx === founderIdx ? "current" : "locked";
    let line = "";
    if (relation === "complete") line = "Complete";
    else if (relation === "locked") line = idx === founderIdx + 1 ? "Up next" : "Locked";
    else if (slug === "onboarding") line = c.onboardingComplete ? "Finishing up" : "Finish onboarding";
    else if (slug === "preparation") {
      if (state.approvalStatus === "pending") line = "Under review — we'll email you";
      else if (state.approvalStatus === "rejected") line = "Changes requested — resubmit";
      else if (!c.requiredDocsUploaded) line = "Upload your 3 core documents";
      else if (!c.readinessQualified) line = `Preparation ${Math.round(c.readinessScore ?? 0)}% of 75% — a little more`;
      else line = "Ready — submitting for review";
    } else if (slug === "marketing") {
      line = opts?.crr && !opts.crr.outreachUnlocked && opts.crr.score !== null
        ? `Held at CRR ${opts.crr.score} — outreach opens at ${opts.crr.gate}`
        : c.hasDealRoom || c.hasInvestorInterest ? "In market" : "Open a data room to advance";
    }
    else line = "Closing your round";
    return { slug, stageNumber: idx + 1, name: STAGE_NAMES[slug], relation, line };
  });

  const cur = STAGE_SLUGS[founderIdx] ?? null;
  let nextAction: FounderNextAction | null = null;
  if (cur === "onboarding") {
    nextAction = c.onboardingComplete
      ? null
      : { title: "Finish onboarding", description: "Complete your profile to unlock your rating and matches.", cta: { label: "Continue onboarding", href: "/founder/onboarding" } };
  } else if (cur === "preparation") {
    if (state.approvalStatus === "pending") {
      nextAction = { title: "You're under review", description: "We'll email you when Marketing opens — typically within ~2 business days.", cta: { label: "View your Preparation status", href: "/founder/stages/preparation" } };
    } else if (!c.requiredDocsUploaded) {
      nextAction = { title: "Upload your 3 core documents", description: "Pitch deck, financials, and cap table — the last requirements before investor matching.", cta: { label: "Upload documents", href: "/founder/qualify" }, secondaryCta: { label: "See what's left", href: "/founder/stages/preparation" } };
    } else if (!c.readinessQualified) {
      nextAction = { title: `Reach 75% Preparation complete — you're at ${Math.round(c.readinessScore ?? 0)}%`, description: "A little more strengthens your materials and opens investor matching.", cta: { label: "Improve your Preparation", href: "/founder/readiness" } };
    } else {
      nextAction = { title: "You're ready — submitting for review", description: "We'll email you the moment Marketing opens.", cta: { label: "See your Preparation status", href: "/founder/stages/preparation" } };
    }
  } else if (cur === "marketing") {
    // Held at the gate: name the number that caused it. Suggesting an unrelated
    // task while the score is what blocks them is how a founder spends a week
    // on the wrong thing.
    const blocker = opts?.crr ? outreachBlocker(opts.crr) : null;
    if (opts?.outreachReady) {
      nextAction = { title: "Send your one-pager to your matched investors", description: "You're outreach-ready — reaching out now is the highest-impact move this week.", cta: { label: "Open outreach", href: "/founder/deploy" }, secondaryCta: { label: "Review matches", href: "/founder/matches" } };
    } else if (blocker) {
      nextAction = {
        title: blocker.title,
        description: blocker.description,
        cta: { label: `Fix the ${opts?.crr?.pointsToGate ?? 0} points`, href: "/founder/readiness/wizard" },
        secondaryCta: { label: "See what investors will ask", href: "/founder/report" },
      };
    } else {
      nextAction = { title: "Open a data room to move toward Closing", description: "A ready data room is what investors ask for next.", cta: { label: "Open your data room", href: "/founder/deal-room" } };
    }
  } else if (cur === "closing") {
    nextAction = { title: "Close your round", description: "Track commitments and coordinate closing.", cta: { label: "Open your deal room", href: "/founder/deal-room" } };
  }

  return { stages, currentSlug: cur, nextAction };
}

const CORE_DOCS = new Set(["pitch deck", "financial model", "cap table"]);

/** The first non-core required document the founder hasn't uploaded (a concrete
 *  suggestion for raising the readiness score). */
async function firstMissingDoc(supabase: SupabaseClient<Database>, profileId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("documents").select("document_type").eq("uploaded_by", profileId);
    const uploaded = new Set(
      ((data ?? []) as { document_type: string | null }[])
        .map((d) => (d.document_type ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    for (const t of requiredDocumentTypes) {
      const k = t.toLowerCase();
      if (CORE_DOCS.has(k)) continue;
      if (!uploaded.has(k)) return t;
    }
  } catch {
    /* suggestion is best-effort */
  }
  return null;
}

export async function getStageGateStatus(
  supabase: SupabaseClient<Database>,
  profileId: string,
  guideSlug: StageSlug,
  /** The rating, so a cleared stage cannot claim more than it earned. */
  crr?: CrrSummary | null,
): Promise<StageGate> {
  const state = await evaluateFounderJourney(supabase, profileId);
  const founderIdx = state.stageIndex;
  const guideIdx = STAGE_SLUGS.indexOf(guideSlug);
  const relation: StageGate["relation"] = guideIdx < founderIdx ? "complete" : guideIdx === founderIdx ? "current" : "locked";
  const nextStageName = STAGE_SLUGS[guideIdx + 1] ? STAGE_NAMES[STAGE_SLUGS[guideIdx + 1]] : null;
  const base = { slug: guideSlug, stageNumber: guideIdx + 1, stageName: STAGE_NAMES[guideSlug], nextStageName, relation, headline: "", items: [] as GateItem[] };

  if (relation === "complete") {
    // Preparation clears on documents, the checklist and approval — none of
    // which is the rating. Saying "Complete" while the rating still holds
    // introductions shut is how a founder reads a green panel and waits.
    const held = guideSlug === "preparation" && crr && !crr.outreachUnlocked && crr.score !== null;
    return {
      ...base,
      headline: "Complete",
      summary: held
        ? `You've cleared ${base.stageName}. Your rating is ${crr.score} of ${crr.gate}, so introductions and automated outreach stay closed until it reaches the gate.`
        : `You've cleared ${base.stageName}.`,
    };
  }
  if (relation === "locked") {
    const prev = STAGE_NAMES[STAGE_SLUGS[guideIdx - 1]];
    return {
      ...base,
      headline: "Locked",
      summary: guideSlug === "marketing" ? `Unlocks when ${prev} is approved by the iCFO team.` : `Unlocks when you reach ${prev}.`,
    };
  }

  // relation === "current" — the detailed gate for the founder's active stage.
  const c = state.conditions;

  if (guideSlug === "onboarding") {
    return {
      ...base,
      headline: `Your path to ${nextStageName}`,
      items: [
        {
          label: "Complete onboarding",
          detail: "Tell us about your company so your rating and matches are built on the right facts.",
          state: c.onboardingComplete ? "done" : "active",
          cta: { label: "Finish onboarding", href: "/founder/onboarding" },
        },
      ],
      primaryCta: c.onboardingComplete ? undefined : { label: "Finish onboarding", href: "/founder/onboarding" },
    };
  }

  if (guideSlug === "preparation") {
    const missing = !c.readinessQualified ? await firstMissingDoc(supabase, profileId) : null;
    const items: GateItem[] = [
      { label: "Onboarding complete", state: c.onboardingComplete ? "done" : "todo" },
      {
        label: "Upload your 3 core documents",
        detail: "Pitch deck · Financials · Cap table",
        state: c.requiredDocsUploaded ? "done" : "active",
        cta: { label: "Upload documents", href: "/founder/qualify" },
      },
      {
        label: "Reach 75% Preparation complete",
        detail: c.readinessQualified
          ? undefined
          : `You're at ${Math.round(c.readinessScore ?? 0)}%.${missing ? ` Add your ${missing} to raise it.` : " Strengthen your materials to raise it."}`,
        state: c.readinessQualified ? "done" : "active",
        cta: { label: "Improve your Preparation", href: "/founder/readiness" },
      },
    ];
    const review: GateReview | undefined =
      state.approvalStatus === "pending"
        ? { status: "pending" }
        : state.approvalStatus === "rejected"
          ? { status: "rejected", feedback: state.approvalFeedback }
          : undefined;
    const active = items.find((i) => i.state === "active");
    return { ...base, headline: `Your path to ${nextStageName}`, items, primaryCta: active?.cta, review };
  }

  if (guideSlug === "marketing") {
    const reached = c.hasDealRoom || c.hasInvestorInterest;
    return {
      ...base,
      headline: `Your path to ${nextStageName}`,
      items: [
        { label: "Preparation approved — your matched list is live", state: "done" },
        {
          label: "Reach investors",
          detail: "Open a data room or log your first investor interest to advance to Closing.",
          state: reached ? "done" : "active",
          cta: { label: "Open your data room", href: "/founder/deal-room" },
        },
      ],
      primaryCta: reached ? undefined : { label: "Open your data room", href: "/founder/deal-room" },
    };
  }

  // closing — the final stage, no further gate.
  return {
    ...base,
    headline: "Final stage",
    items: [
      {
        label: "Close your round",
        detail: "Track commitments, manage diligence, and coordinate closing.",
        state: "active",
        cta: { label: "Open your deal room", href: "/founder/deal-room" },
      },
    ],
    primaryCta: { label: "Open your deal room", href: "/founder/deal-room" },
  };
}
