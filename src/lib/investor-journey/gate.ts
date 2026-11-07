// Investor "path to the next stage", in the same shape the founder gate uses
// (GateItem, GateReview) so both journeys read and look alike. Pure logic:
// onboard (profile approval) -> verify (KYC) -> access (deal flow) -> manage.

import type { GateCta, GateItem, GateReview } from "@/lib/founder/stage-gate-status";
import { INVESTOR_STAGES, INVESTOR_STAGE_META, deriveInvestorStageKey, investorStageIndex, lockedStageHint, type InvestorStageKey } from "./stages";

export type InvestorGateInput = {
  approvalStatus: string | null | undefined;
  kycStatus: string | null | undefined;
  /** Required verification documents not yet uploaded. */
  kycMissingCount: number;
  hasCommitment: boolean;
  /** Admin note on a rejected or changes requested profile. */
  adminFeedback?: string | null;
  /** Admin note on a rejected verification. */
  kycFeedback?: string | null;
};

export type InvestorStageGate = {
  key: InvestorStageKey;
  stageNumber: number;
  stageName: string;
  nextStageName: string | null;
  relation: "complete" | "current" | "locked";
  headline: string;
  /** Short line for complete and locked states. */
  summary?: string;
  /** The checklist, for the current stage. */
  items: GateItem[];
  primaryCta?: GateCta;
  review?: GateReview;
};

function currentGate(key: InvestorStageKey, input: InvestorGateInput): Pick<InvestorStageGate, "items" | "primaryCta" | "review"> {
  const approval = input.approvalStatus ?? "draft";
  const kyc = input.kycStatus ?? "not_started";

  if (key === "onboard") {
    if (approval === "submitted") {
      return {
        items: [
          { label: "Investor profile submitted", state: "done" },
          { label: "iCapOS reviews your profile", detail: "We email you the result, usually within a day or two.", state: "active" },
        ],
        review: { status: "pending" },
      };
    }
    if (approval === "rejected" || approval === "changes_requested") {
      return {
        items: [
          { label: "Update your investor profile", detail: "Review the note from the team, then resubmit.", state: "active", cta: { label: "Update profile", href: "/investor/onboarding" } },
          { label: "iCapOS reviews your profile", state: "todo" },
        ],
        primaryCta: { label: "Update profile", href: "/investor/onboarding" },
        review: { status: "rejected", feedback: input.adminFeedback ?? null },
      };
    }
    return {
      items: [
        { label: "Complete your investor profile", detail: "Firm, focus, check size, and your thesis.", state: "active", cta: { label: "Continue onboarding", href: "/investor/onboarding" } },
        { label: "iCapOS reviews your profile", state: "todo" },
      ],
      primaryCta: { label: "Continue onboarding", href: "/investor/onboarding" },
    };
  }

  if (key === "verify") {
    const approved: GateItem = { label: "Investor profile approved", state: "done" };
    if (kyc === "pending") {
      return {
        items: [approved, { label: "Verification documents submitted", state: "done" }, { label: "iCapOS verifies your documents", detail: "Deals access opens the moment they are verified.", state: "active" }],
        review: { status: "pending" },
      };
    }
    if (kyc === "rejected") {
      return {
        items: [
          approved,
          { label: "Re-upload the document we could not accept", state: "active", cta: { label: "Fix verification", href: "/investor/verification" } },
          { label: "iCapOS verifies your documents", state: "todo" },
        ],
        primaryCta: { label: "Fix verification", href: "/investor/verification" },
        review: { status: "rejected", feedback: input.kycFeedback ?? null },
      };
    }
    const left = input.kycMissingCount;
    return {
      items: [
        approved,
        {
          label: "Upload your identity and accreditation documents",
          detail: left > 0 ? `${left} required document${left === 1 ? "" : "s"} left.` : "Ready to submit.",
          state: "active",
          cta: { label: "Start verification", href: "/investor/verification" },
        },
        { label: "iCapOS verifies your documents", state: "todo" },
      ],
      primaryCta: { label: "Start verification", href: "/investor/verification" },
    };
  }

  const done: GateItem[] = [
    { label: "Investor profile approved", state: "done" },
    { label: "Identity and accreditation verified", state: "done" },
  ];
  if (key === "access") {
    return {
      items: [...done, { label: "Make your first move", detail: "Express interest in a company or open a conversation.", state: "active", cta: { label: "Browse the Private Market", href: "/investor/opportunities" } }],
      primaryCta: { label: "Browse the Private Market", href: "/investor/opportunities" },
    };
  }
  return {
    items: [...done, { label: "Track your commitments", detail: "Pledges, closings, and document requests.", state: "active", cta: { label: "Open your portfolio", href: "/investor/portfolio" } }],
    primaryCta: { label: "Open your portfolio", href: "/investor/portfolio" },
  };
}

/** One gate per stage. The current stage carries the checklist. */
export function buildInvestorStageGates(input: InvestorGateInput): InvestorStageGate[] {
  const currentKey = deriveInvestorStageKey({ approvalStatus: input.approvalStatus, kycStatus: input.kycStatus, hasCommitment: input.hasCommitment });
  const currentIndex = investorStageIndex(currentKey);
  return INVESTOR_STAGES.map((key) => {
    const meta = INVESTOR_STAGE_META[key];
    const next = INVESTOR_STAGES[meta.index + 1];
    const relation: InvestorStageGate["relation"] = meta.index < currentIndex ? "complete" : meta.index === currentIndex ? "current" : "locked";
    const base = {
      key,
      stageNumber: meta.number,
      stageName: meta.label,
      nextStageName: next ? INVESTOR_STAGE_META[next].label : null,
      relation,
      headline: `Stage ${meta.number}, ${meta.label}`,
    };
    if (relation === "complete") return { ...base, summary: "Complete", items: [] };
    if (relation === "locked") return { ...base, summary: lockedStageHint(key), items: [] };
    return { ...base, ...currentGate(key, input) };
  });
}

export function currentInvestorGate(gates: InvestorStageGate[]): InvestorStageGate {
  return gates.find((g) => g.relation === "current") ?? gates[0];
}

/** Title and body for the lock card on a gated page, same wording pattern as the founder gate. */
export function investorLockCopy(input: Pick<InvestorGateInput, "approvalStatus" | "kycStatus">): { title: string; description: string } {
  if (input.approvalStatus !== "approved") {
    return input.approvalStatus === "submitted"
      ? { title: "Approval pending, we'll notify you when ready", description: "Your profile is with the iCapOS team. Deals access opens after your profile is approved and your verification is complete." }
      : { title: "Complete Stage 1, Onboarding to unlock this", description: "Finish and submit your investor profile. Deals access opens after approval and verification." };
  }
  return input.kycStatus === "pending"
    ? { title: "Verification pending, we'll notify you when ready", description: "Your documents are with the iCapOS team. This opens the moment they are verified." }
    : { title: "Complete Stage 2, Verification to unlock this", description: "Verify your identity and accreditation to open Deals access (Stage 3) and Manage deals (Stage 4)." };
}
