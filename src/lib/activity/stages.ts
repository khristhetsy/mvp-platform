/**
 * The stage taxonomy account activity is organised by.
 *
 * Founders move through the four journey stages already defined in
 * `@/lib/founder-journey/types` — this module re-exports them rather than
 * redeclaring, so a change there cannot silently diverge from the activity
 * feed. Investors move through `INVESTOR_PIPELINE_STAGES`, which are five and
 * are NOT the founder's four: forcing investor activity into founder stages
 * would make the fold label a lie.
 *
 * Everything in this file is pure. No Supabase, no fetch — so the classes and
 * their severities are testable and the emitters can import them from anywhere.
 */
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import {
  INVESTOR_PIPELINE_STAGES,
  INVESTOR_PIPELINE_STAGE_LABEL,
} from "@/lib/investor-crm/pipeline-logic";
import type { OperationalEventSeverity } from "@/lib/operational-activity/types";

export type ActivityAudience = "founder" | "investor";

export type FounderStage = JourneyStage;
export type InvestorStage = (typeof INVESTOR_PIPELINE_STAGES)[number];
export type ActivityStage = FounderStage | InvestorStage;

export const FOUNDER_STAGES = JOURNEY_STAGES;
export const INVESTOR_STAGES = INVESTOR_PIPELINE_STAGES;

export const ALL_ACTIVITY_STAGES: readonly ActivityStage[] = [
  ...FOUNDER_STAGES,
  ...INVESTOR_STAGES,
];

/** Founder stage labels match the admin stage mirror exactly. */
const FOUNDER_STAGE_LABEL: Record<FounderStage, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};

/** Investor labels come from the pipeline board — one source, so they cannot drift. */
const INVESTOR_STAGE_LABEL = INVESTOR_PIPELINE_STAGE_LABEL;

export function isFounderStage(value: string): value is FounderStage {
  return (FOUNDER_STAGES as readonly string[]).includes(value);
}

export function isInvestorStage(value: string): value is InvestorStage {
  return (INVESTOR_STAGES as readonly string[]).includes(value);
}

export function isActivityStage(value: string): value is ActivityStage {
  return isFounderStage(value) || isInvestorStage(value);
}

export function audienceOfStage(stage: ActivityStage): ActivityAudience {
  return isFounderStage(stage) ? "founder" : "investor";
}

export function stagesFor(audience: ActivityAudience): readonly ActivityStage[] {
  return audience === "founder" ? FOUNDER_STAGES : INVESTOR_STAGES;
}

/** "Stage 2 · Preparation" for founders, "Engaged" for investors. */
export function activityStageLabel(stage: ActivityStage): string {
  if (isFounderStage(stage)) {
    const n = FOUNDER_STAGES.indexOf(stage) + 1;
    return `Stage ${n} · ${FOUNDER_STAGE_LABEL[stage]}`;
  }
  return INVESTOR_STAGE_LABEL[stage as InvestorStage];
}

/** Bare label with no ordinal — for chips and table cells. */
export function activityStageShortLabel(stage: ActivityStage): string {
  return isFounderStage(stage)
    ? FOUNDER_STAGE_LABEL[stage]
    : INVESTOR_STAGE_LABEL[stage as InvestorStage];
}

/**
 * An activity class is a group of event types a person would want to be told
 * about as one thing. The preference grid has one row per class, not one row
 * per event type — 100+ event types with three switches each is a screen nobody
 * configures.
 */
export type ActivityClassKey =
  // founder · initialize
  | "onboarding_completed"
  | "profile_edited"
  | "capital_ask_changed"
  | "one_pager_visibility"
  // founder · qualify
  | "document_changed"
  | "document_deleted"
  | "crr_moved"
  | "crr_gate_crossed"
  | "cap_table_changed"
  | "data_room_access_changed"
  // founder · deploy
  | "outreach_launched"
  | "outreach_below_gate"
  | "interest_stage_changed"
  | "intro_requested"
  | "marketplace_visibility"
  | "deal_saved"
  // founder · optimize
  | "deal_room_changed"
  | "offering_type_changed"
  | "offering_changed_after_spv"
  | "spv_participation_changed"
  | "investor_update_sent"
  // investor
  | "investor_profile_edited"
  | "investor_thesis_changed"
  | "investor_signed_up"
  | "campaign_replied"
  | "meeting_booked"
  | "opted_out"
  | "watchlist_changed"
  | "deck_viewed"
  | "data_room_downloaded"
  | "diligence_question_asked"
  | "participation_signed"
  | "participation_withdrawn";

/** Who an alert goes to on top of the stage owners. */
export type ActivityOverrideTarget = "compliance" | "ceo";

export type ActivityClass = {
  key: ActivityClassKey;
  stage: ActivityStage;
  label: string;
  description: string;
  severity: OperationalEventSeverity;
  /**
   * True when this class must never be held for a digest. A deletion, a gate
   * crossing, or an offering change after money has been committed is worthless
   * twelve hours late — so the digest switch is not merely off by default, it is
   * unavailable.
   */
  digestable: boolean;
  /** Extra recipients beyond the stage owners. These are firm risk, not stage work. */
  overrides?: ActivityOverrideTarget[];
  /** Default channel state when no preference row exists yet. */
  defaults: { in_app: boolean; email: boolean; digest: boolean };
};

const on = { in_app: true, email: true, digest: true };
const appMail = { in_app: true, email: true, digest: false };
const appDigest = { in_app: true, email: false, digest: true };
const digestOnly = { in_app: false, email: false, digest: true };

export const ACTIVITY_CLASSES: readonly ActivityClass[] = [
  // ---- Founder · Stage 1 Onboarding -------------------------------------
  {
    key: "onboarding_completed",
    stage: "initialize",
    label: "Onboarding completed",
    description: "All steps answered — advances the founder to Preparation",
    severity: "low",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "profile_edited",
    stage: "initialize",
    label: "Profile edited",
    description: "Summary, industries, team, highlights, logo",
    severity: "info",
    digestable: true,
    defaults: appDigest,
  },
  {
    key: "capital_ask_changed",
    stage: "initialize",
    label: "Capital ask or valuation changed",
    description: "Feeds the CRR Capital factor and every investor match",
    severity: "medium",
    digestable: true,
    defaults: on,
  },
  {
    key: "one_pager_visibility",
    stage: "initialize",
    label: "One-pager published or unpublished",
    description: "The public /f/<slug> page becomes reachable or disappears",
    severity: "medium",
    digestable: false,
    overrides: ["compliance"],
    defaults: appMail,
  },

  // ---- Founder · Stage 2 Preparation ------------------------------------
  {
    key: "document_changed",
    stage: "qualify",
    label: "Document uploaded or replaced",
    description: "Deck, financials, business plan, cap table",
    severity: "low",
    digestable: true,
    defaults: on,
  },
  {
    key: "document_deleted",
    stage: "qualify",
    label: "Document or data-room file deleted",
    description: "Destructive — the file is gone from what investors can read",
    severity: "high",
    digestable: false,
    overrides: ["compliance"],
    defaults: appMail,
  },
  {
    key: "crr_moved",
    stage: "qualify",
    label: "CRR moved",
    description: "Any change of 3 points or more, in either direction",
    severity: "low",
    digestable: true,
    defaults: on,
  },
  {
    key: "crr_gate_crossed",
    stage: "qualify",
    label: "CRR crossed the outreach gate",
    description: "Up unlocks outreach; down means outreach should stop",
    severity: "high",
    digestable: false,
    overrides: ["ceo"],
    defaults: appMail,
  },
  {
    key: "cap_table_changed",
    stage: "qualify",
    label: "Cap table changed",
    description: "Shareholder added, removed or diluted",
    severity: "medium",
    digestable: true,
    defaults: on,
  },
  {
    key: "data_room_access_changed",
    stage: "qualify",
    label: "Data-room access granted or revoked",
    description: "Who can see what",
    severity: "high",
    digestable: false,
    overrides: ["compliance"],
    defaults: appMail,
  },

  // ---- Founder · Stage 3 Marketing --------------------------------------
  {
    key: "outreach_launched",
    stage: "deploy",
    label: "Outreach campaign launched",
    description: "Who it goes to, how many, and when it sends",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "outreach_below_gate",
    stage: "deploy",
    label: "Outreach launched below the gate",
    description: "CRR under the outreach threshold — the firm's name is on this",
    severity: "critical",
    digestable: false,
    overrides: ["ceo"],
    defaults: appMail,
  },
  {
    key: "interest_stage_changed",
    stage: "deploy",
    label: "Investor interest stage changed",
    description: "Watchlist → diligence → committed",
    severity: "low",
    digestable: true,
    defaults: on,
  },
  {
    key: "intro_requested",
    stage: "deploy",
    label: "Intro requested",
    description: "An investor asked to be introduced",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "marketplace_visibility",
    stage: "deploy",
    label: "Marketplace listing published or pulled",
    description: "Visibility to every investor on the platform",
    severity: "medium",
    digestable: true,
    defaults: appDigest,
  },
  {
    key: "deal_saved",
    stage: "deploy",
    label: "Investor saved or unsaved a deal",
    description: "High volume, low signal — digest by default",
    severity: "info",
    digestable: true,
    defaults: digestOnly,
  },

  // ---- Founder · Stage 4 Closing ----------------------------------------
  {
    key: "deal_room_changed",
    stage: "optimize",
    label: "Deal room opened or closed",
    description: "And who was admitted to it",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "offering_type_changed",
    stage: "optimize",
    label: "Offering type changed",
    description: "SAFE, priced equity or note",
    severity: "high",
    digestable: false,
    overrides: ["compliance"],
    defaults: appMail,
  },
  {
    key: "offering_changed_after_spv",
    stage: "optimize",
    label: "Offering type changed after an SPV opened",
    description: "Participations were already signed against the old terms",
    severity: "critical",
    digestable: false,
    overrides: ["ceo", "compliance"],
    defaults: appMail,
  },
  {
    key: "spv_participation_changed",
    stage: "optimize",
    label: "SPV participation added or withdrawn",
    description: "Money moving",
    severity: "high",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "investor_update_sent",
    stage: "optimize",
    label: "Investor update sent",
    description: "What the founder told their investors, and when",
    severity: "info",
    digestable: true,
    defaults: appDigest,
  },

  // ---- Investor · Prospect ----------------------------------------------
  {
    key: "investor_signed_up",
    stage: "prospect",
    label: "Investor signed up",
    description: "A new investor account reached the platform",
    severity: "low",
    digestable: true,
    defaults: appDigest,
  },
  {
    key: "investor_profile_edited",
    stage: "prospect",
    label: "Investor profile edited",
    description: "Firm, role, contact details",
    severity: "info",
    digestable: true,
    defaults: digestOnly,
  },
  {
    key: "investor_thesis_changed",
    stage: "prospect",
    label: "Investment thesis changed",
    description: "Sectors, stage, cheque size — changes every match they see",
    severity: "medium",
    digestable: true,
    defaults: on,
  },

  // ---- Investor · Outreach ----------------------------------------------
  {
    key: "campaign_replied",
    stage: "outreach",
    label: "Replied to a campaign",
    description: "A real human answer to automated outreach",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "meeting_booked",
    stage: "outreach",
    label: "Meeting booked",
    description: "A slot was taken on a founder's calendar",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "opted_out",
    stage: "outreach",
    label: "Opted out of outreach",
    description: "Must stop every sequence for this investor immediately",
    severity: "high",
    digestable: false,
    overrides: ["compliance"],
    defaults: appMail,
  },

  // ---- Investor · Engaged -----------------------------------------------
  {
    key: "watchlist_changed",
    stage: "engaged",
    label: "Watchlist changed",
    description: "Added or removed a company from their watchlist",
    severity: "low",
    digestable: true,
    defaults: appDigest,
  },
  {
    key: "deck_viewed",
    stage: "engaged",
    label: "Pitch deck viewed",
    description: "Which deck, how long, how far through",
    severity: "info",
    digestable: true,
    defaults: digestOnly,
  },

  // ---- Investor · Diligence ---------------------------------------------
  {
    key: "data_room_downloaded",
    stage: "diligence",
    label: "Data-room files downloaded",
    description: "The founder is told who read what",
    severity: "medium",
    digestable: true,
    defaults: on,
  },
  {
    key: "diligence_question_asked",
    stage: "diligence",
    label: "Diligence question asked",
    description: "Waiting on a founder or staff answer",
    severity: "medium",
    digestable: false,
    defaults: appMail,
  },

  // ---- Investor · Committed ---------------------------------------------
  {
    key: "participation_signed",
    stage: "committed",
    label: "Participation signed",
    description: "A commitment became a signature",
    severity: "high",
    digestable: false,
    defaults: appMail,
  },
  {
    key: "participation_withdrawn",
    stage: "committed",
    label: "Participation withdrawn",
    description: "Signed money leaving the round",
    severity: "critical",
    digestable: false,
    overrides: ["ceo"],
    defaults: appMail,
  },
];

const CLASS_BY_KEY = new Map(ACTIVITY_CLASSES.map((c) => [c.key, c]));

export function activityClass(key: ActivityClassKey): ActivityClass | null {
  return CLASS_BY_KEY.get(key) ?? null;
}

export function classesForStage(stage: ActivityStage): ActivityClass[] {
  return ACTIVITY_CLASSES.filter((c) => c.stage === stage);
}

export function classesForAudience(audience: ActivityAudience): ActivityClass[] {
  return ACTIVITY_CLASSES.filter((c) => audienceOfStage(c.stage) === audience);
}

/**
 * Every emitted event carries a class key as its `event_type`, prefixed with the
 * audience so the activity rows can never collide with the pre-existing
 * staff/system event types recorded since 0044 (`digest_generated`,
 * `workflow_blocked`, and so on).
 */
export function activityEventType(key: ActivityClassKey): string {
  const cls = CLASS_BY_KEY.get(key);
  const audience = cls ? audienceOfStage(cls.stage) : "founder";
  return `${audience}.${key}`;
}

export function classKeyFromEventType(eventType: string): ActivityClassKey | null {
  const bare = eventType.includes(".") ? eventType.slice(eventType.indexOf(".") + 1) : eventType;
  return CLASS_BY_KEY.has(bare as ActivityClassKey) ? (bare as ActivityClassKey) : null;
}

/** True when the event is one of ours rather than a 0044 staff/system row. */
export function isAccountActivityEvent(eventType: string): boolean {
  return classKeyFromEventType(eventType) !== null;
}
