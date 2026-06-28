// Investor 4-stage journey — the spine of the investor workspace.
// Onboard (profile approval) → Verify (KYC) → Access (deal flow) → Manage (active deals).
// Pure logic; the loader that supplies `hasCommitment` lives in ./load.

export const INVESTOR_STAGES = ["onboard", "verify", "access", "manage"] as const;
export type InvestorStageKey = (typeof INVESTOR_STAGES)[number];

export type InvestorStageMeta = {
  key: InvestorStageKey;
  index: number;
  number: number; // 1-based, for "Stage N" copy
  label: string;
  short: string;
  description: string;
};

export const INVESTOR_STAGE_META: Record<InvestorStageKey, InvestorStageMeta> = {
  onboard: {
    key: "onboard",
    index: 0,
    number: 1,
    label: "Onboarding",
    short: "Onboard",
    description: "Set up your investor profile and get approved.",
  },
  verify: {
    key: "verify",
    index: 1,
    number: 2,
    label: "Verification",
    short: "Verify",
    description: "Verify your identity and accreditation to unlock deal flow.",
  },
  access: {
    key: "access",
    index: 2,
    number: 3,
    label: "Deals access",
    short: "Access",
    description: "Browse the marketplace, express interest, request intros, and join SPVs.",
  },
  manage: {
    key: "manage",
    index: 3,
    number: 4,
    label: "Manage deals",
    short: "Manage",
    description: "Track your commitments, closings, and portfolio.",
  },
};

export function investorStageIndex(stage: InvestorStageKey): number {
  return INVESTOR_STAGES.indexOf(stage);
}

export type InvestorStageInput = {
  approvalStatus: string | null | undefined;
  kycStatus: string | null | undefined;
  /** True once the investor has any soft-committed/active SPV participation or pledge. */
  hasCommitment: boolean;
};

/** Derive the investor's current stage from real account signals. Linear: a later
 *  stage implies every earlier one is complete. */
export function deriveInvestorStageKey(input: InvestorStageInput): InvestorStageKey {
  if (input.approvalStatus !== "approved") return "onboard";
  if (input.kycStatus !== "verified") return "verify";
  if (input.hasCommitment) return "manage";
  return "access";
}

export type InvestorStageView = {
  current: InvestorStageMeta;
  currentIndex: number;
  /** Per-stage status for rendering a tracker. */
  stages: Array<InvestorStageMeta & { status: "complete" | "current" | "locked" }>;
  percent: number;
};

/** Build a full tracker view (every stage + its status) for the dashboard. */
export function buildInvestorStageView(input: InvestorStageInput): InvestorStageView {
  const currentKey = deriveInvestorStageKey(input);
  const currentIndex = investorStageIndex(currentKey);
  const stages = INVESTOR_STAGES.map((key) => {
    const meta = INVESTOR_STAGE_META[key];
    const status: "complete" | "current" | "locked" =
      meta.index < currentIndex ? "complete" : meta.index === currentIndex ? "current" : "locked";
    return { ...meta, status };
  });
  // Manage (index 3) is terminal — being in it is "100%".
  const percent = Math.round((currentIndex / (INVESTOR_STAGES.length - 1)) * 100);
  return { current: INVESTOR_STAGE_META[currentKey], currentIndex, stages, percent };
}
