// Mirrors the founder's Stage 1–4 menu inside the admin company workspace so
// staff land on the exact founder screen that's blocking. Item status is derived
// from the same journey conditions the founder gate uses (single source of truth);
// items without a cheap signal render neutral rather than showing a fake status.

import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

export type MirrorItemStatus = "done" | "attention" | "missing" | "todo" | "locked";

export type MirrorItem = {
  label: string;
  /** Founder route this item lives at (Phase 3 upgrades Open to act-on-behalf). */
  href: string;
  status: MirrorItemStatus;
};

export type StageMirror = {
  stage: JourneyStage;
  reached: boolean;
  items: MirrorItem[];
  doneCount: number;
  total: number;
  recommendation: string;
};

type ConditionKey = "onboardingComplete" | "readinessQualified" | "requiredDocsUploaded" | "hasDealRoom" | "hasInvestorInterest";

type MenuDef = { label: string; href: string; condition?: ConditionKey };

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
    { label: "Capital Readiness Rating", href: "/founder/readiness/wizard", condition: "readinessQualified" },
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
    { label: "Investor matches", href: "/founder/matches" },
    { label: "Matching Center", href: "/founder/matching" },
    { label: "Automated outreach", href: "/founder/deploy" },
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
    // Past stage without a signal: treat as done; current stage: neutral to-do.
    return { label: d.label, href: d.href, status: isCurrent ? "todo" : "done" };
  });

  const doneCount = items.filter((i) => i.status === "done").length;
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

  return { stage, reached, items, doneCount, total: items.length, recommendation };
}
