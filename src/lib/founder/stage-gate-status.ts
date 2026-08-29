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
export type JourneyOverview = {
  stages: JourneyStageSummary[];
  currentSlug: StageSlug | null;
};

/** Compact four-stage summary for the dashboard — one evaluate call, one line
 *  of status per stage. Same source of truth as the per-guide gate panel. */
export async function getJourneyOverview(
  supabase: SupabaseClient<Database>,
  profileId: string,
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
      else if (!c.readinessQualified) line = `Readiness ${Math.round(c.readinessScore ?? 0)}/75 — a little more`;
      else line = "Ready — submitting for review";
    } else if (slug === "marketing") line = c.hasDealRoom || c.hasInvestorInterest ? "In market" : "Open a data room to advance";
    else line = "Closing your round";
    return { slug, stageNumber: idx + 1, name: STAGE_NAMES[slug], relation, line };
  });

  return { stages, currentSlug: STAGE_SLUGS[founderIdx] ?? null };
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
): Promise<StageGate> {
  const state = await evaluateFounderJourney(supabase, profileId);
  const founderIdx = state.stageIndex;
  const guideIdx = STAGE_SLUGS.indexOf(guideSlug);
  const relation: StageGate["relation"] = guideIdx < founderIdx ? "complete" : guideIdx === founderIdx ? "current" : "locked";
  const nextStageName = STAGE_SLUGS[guideIdx + 1] ? STAGE_NAMES[STAGE_SLUGS[guideIdx + 1]] : null;
  const base = { slug: guideSlug, stageNumber: guideIdx + 1, stageName: STAGE_NAMES[guideSlug], nextStageName, relation, headline: "", items: [] as GateItem[] };

  if (relation === "complete") {
    return { ...base, headline: "Complete", summary: `You've cleared ${base.stageName}.` };
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
        label: "Reach a Capital Readiness score of 75",
        detail: c.readinessQualified
          ? undefined
          : `You're at ${Math.round(c.readinessScore ?? 0)}.${missing ? ` Add your ${missing} to raise it.` : " Strengthen your materials to raise it."}`,
        state: c.readinessQualified ? "done" : "active",
        cta: { label: "Improve your readiness", href: "/founder/readiness" },
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
