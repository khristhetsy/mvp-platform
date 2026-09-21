// Mirrors the founder's Stage 1–4 menu inside the admin company workspace so
// staff land on the exact founder screen that's blocking. Item status is derived
// from the same journey conditions the founder gate uses (single source of truth);
// items without a cheap signal render neutral rather than showing a fake status.

import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

export type MirrorItemStatus = "done" | "attention" | "missing" | "todo" | "locked" | "partial";

export type MirrorItem = {
  label: string;
  /** Founder route this item lives at. */
  href: string;
  status: MirrorItemStatus;
};

export type StageMirror = {
  stage: JourneyStage;
  reached: boolean;
  items: MirrorItem[];
  doneCount: number;
  total: number;
  /** How many of the items have a wired signal at all — the honest denominator. */
  measuredCount: number;
  recommendation: string;
};

type ConditionKey =
  | "onboardingComplete"
  | "readinessQualified"
  | "crrQualified"
  | "requiredDocsUploaded"
  | "hasDealRoom"
  | "hasInvestorInterest";

type MenuDef = {
  label: string;
  href: string;
  /** Unmet ⇒ "attention", and the item counts as blocking the stage. */
  condition?: ConditionKey;
  /**
   * Unmet ⇒ "partial": part of the page still works, so it is NOT blocking.
   * Investor matches and the Matching Center are browsable at any CRR — it is
   * the "Request introduction" action inside them that the gate holds.
   */
  partialCondition?: ConditionKey;
};

// Pulled from the founder V2 nav (founderWorkspaceNavSectionsV2). Keep in sync if
// the founder menu changes. `condition` links an item to a journey gate signal.
const STAGE_MENU: Record<JourneyStage, MenuDef[]> = {
  initialize: [
    { label: "Company profile", href: "/founder/settings", condition: "onboardingComplete" },
    { label: "My Progress", href: "/founder/journey" },
    { label: "Action Center", href: "/founder/actions" },
    { label: "One pager", href: "/founder/preview" },
  ],
  qualify: [
    // Label, drawer and condition now all mean the CRR. This used to read
    // `readinessQualified` — the Preparation document count (75%) — so the row
    // reported a CRR requirement as met on the strength of file uploads.
    { label: "Capital Readiness Rating", href: "/founder/readiness/wizard", condition: "crrQualified" },
    { label: "Readiness checklist", href: "/founder/readiness" },
    { label: "Data room", href: "/founder/readiness/data-room" },
    { label: "Documents", href: "/founder/documents", condition: "requiredDocsUploaded" },
    { label: "Business plan", href: "/founder/business-plan" },
    { label: "Pitch deck", href: "/founder/pitch-deck" },
    { label: "Financial model", href: "/founder/financial-model" },
    { label: "Cap table", href: "/founder/cap-table" },
    { label: "Valuation Studio", href: "/founder/valuation" },
  ],
  deploy: [
    // The requirement this stage runs on, stated first. Everything below that the
    // gate touches points back at this row.
    { label: "Capital Readiness Rating", href: "/founder/readiness/wizard", condition: "crrQualified" },
    // Browsing is open at any CRR; "Request introduction" is what the gate holds.
    { label: "Investor matches", href: "/founder/matches", partialCondition: "crrQualified" },
    { label: "Matching Center", href: "/founder/matching", partialCondition: "crrQualified" },
    // Sends into the iCapOS investor data from iCapOS infrastructure — hard gate.
    { label: "Automated outreach", href: "/founder/deploy", condition: "crrQualified" },
    { label: "Investor CRM", href: "/founder/investor-pipeline", condition: "hasInvestorInterest" },
    { label: "Present at event", href: "/founder/events/present" },
    { label: "Marketplace", href: "/founder/private-market" },
  ],
  optimize: [
    { label: "Deal Room", href: "/founder/deal-room", condition: "hasDealRoom" },
    { label: "Offering type", href: "/founder/offering-type" },
    { label: "SPVs & closings", href: "/founder/spvs" },
    { label: "Capital Raise", href: "/founder/capital-raise" },
    { label: "Investor update builder", href: "/founder/investor-update" },
    { label: "Milestones", href: "/founder/milestones" },
    { label: "Analytics", href: "/founder/analytics" },
  ],
};

const STAGE_LABEL: Record<JourneyStage, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};

export function stageLabel(stage: JourneyStage): string {
  return STAGE_LABEL[stage];
}

function conditionMet(journey: FounderJourneyState, key: ConditionKey): boolean {
  const c = journey.conditions as Record<string, unknown>;
  return Boolean(c[key]);
}

export function getStageMirror(journey: FounderJourneyState, stage: JourneyStage): StageMirror {
  const tabIndex = JOURNEY_STAGES.indexOf(stage);
  const reached = tabIndex <= journey.stageIndex;
  const isCurrent = tabIndex === journey.stageIndex;
  const defs = STAGE_MENU[stage] ?? [];

  const items: MirrorItem[] = defs.map((d) => {
    if (!reached) return { label: d.label, href: d.href, status: "locked" };
    if (d.condition) {
      return { label: d.label, href: d.href, status: conditionMet(journey, d.condition) ? "done" : "attention" };
    }
    // Partially gated: the page is usable, one action inside it is held. Shown as
    // "Browse only" and deliberately NOT counted as blocking — the row the gate
    // belongs to carries that, and counting it here would say the same thing three
    // times in one header.
    if (d.partialCondition) {
      return { label: d.label, href: d.href, status: conditionMet(journey, d.partialCondition) ? "done" : "partial" };
    }
    // No signal wired for this item. It is NOT done just because the founder
    // moved past the stage — marking it done was a fake pass that produced
    // "9 of 9 done" on a company with no documents uploaded at all.
    return { label: d.label, href: d.href, status: "todo" };
  });

  // Only measured passes count. An item nobody checks can never be "done".
  // A partially gated item IS measured — it has a wired signal — so it belongs in
  // the denominator even though it never blocks.
  const doneCount = items.filter((i) => i.status === "done").length;
  const measuredCount = defs.filter((d) => d.condition || d.partialCondition).length;
  const unmet = items.filter((i) => i.status === "attention" || i.status === "missing").map((i) => i.label);

  let recommendation: string;
  if (!reached) {
    const prev = tabIndex > 0 ? STAGE_LABEL[JOURNEY_STAGES[tabIndex - 1]] : "the previous stage";
    recommendation = `Unlocks once ${prev} clears. Items shown for visibility.`;
  } else if (unmet.length > 0) {
    recommendation = `Blocking ${STAGE_LABEL[stage]}: ${unmet.join(", ")}. Open the item to resolve it with the founder.`;
  } else if (isCurrent && journey.pendingApproval) {
    recommendation = `All tracked items are met — the founder is awaiting your stage approval.`;
  } else {
    recommendation = `On track — no blocking items in ${STAGE_LABEL[stage]}.`;
  }

  return { stage, reached, items, doneCount, total: items.length, measuredCount, recommendation };
}
