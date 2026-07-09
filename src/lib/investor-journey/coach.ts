import { CLAUDE_HAIKU, claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { INVESTOR_STAGE_META, type InvestorStageKey } from "./stages";

export type InvestorCoachInput = {
  stage: InvestorStageKey;
  approvalStatus: string | null | undefined;
  kycStatus: string | null | undefined;
  /** Required KYC docs not yet uploaded (verify stage). */
  kycMissingCount?: number;
  /** Whether the investor has expressed interest / opened any conversation yet. */
  hasEngaged?: boolean;
};

export type InvestorStageCoach = {
  stage: InvestorStageKey;
  /** The single next step. */
  headline: string;
  body: string;
  action: { label: string; href: string } | null;
  /** Optional Partner Score nudge, when the step also moves the score. */
  scoreHint: string | null;
  source: "deterministic" | "ai";
};

/**
 * The one next step for an investor, derived from their real stage + state.
 * Deterministic and pure — this is the source of truth the AI layer phrases.
 */
export function buildInvestorStageCoach(input: InvestorCoachInput): InvestorStageCoach {
  const base = { stage: input.stage, scoreHint: null as string | null, source: "deterministic" as const };

  switch (input.stage) {
    case "onboard": {
      if (input.approvalStatus === "submitted") {
        return {
          ...base,
          headline: "Your profile is under review",
          body: "The iCapOS team is reviewing your profile — usually a day or two. You can browse opportunities while you wait.",
          action: { label: "Browse opportunities", href: "/investor/opportunities" },
        };
      }
      if (input.approvalStatus === "rejected" || input.approvalStatus === "changes_requested") {
        return {
          ...base,
          headline: "Update your profile and resubmit",
          body: "The team asked for a few changes before approving. Review the note on your profile, update it, and resubmit.",
          action: { label: "Update profile", href: "/investor/onboarding" },
        };
      }
      return {
        ...base,
        headline: "Finish your investor profile",
        body: "Complete your thesis, sectors, stages, and check size so we can approve you and founders understand your fit.",
        action: { label: "Continue onboarding", href: "/investor/onboarding" },
      };
    }

    case "verify": {
      if (input.kycStatus === "pending") {
        return {
          ...base,
          headline: "Verification under review",
          body: "Your documents are with the team. Full deal-flow access unlocks the moment they're verified.",
          action: { label: "View verification", href: "/investor/verification" },
        };
      }
      if (input.kycStatus === "rejected") {
        return {
          ...base,
          headline: "Re-upload a verification document",
          body: "One of your documents couldn't be accepted. Check the note, re-upload, and resubmit to unlock access.",
          action: { label: "Fix verification", href: "/investor/verification" },
          scoreHint: "Verifying is also your biggest Partner Score lever — about +8 points.",
        };
      }
      const missing = input.kycMissingCount ?? 0;
      return {
        ...base,
        headline:
          missing > 0
            ? `Upload ${missing} more document${missing === 1 ? "" : "s"} to verify`
            : "Submit your documents for verification",
        body: "Verifying your identity and accreditation unlocks expressing interest, intros, SPVs, and full data rooms.",
        action: { label: "Start verification", href: "/investor/verification" },
        scoreHint: "A verified accreditation is your strongest credibility signal — worth about +8 to your Partner Score.",
      };
    }

    case "access": {
      if (!input.hasEngaged) {
        return {
          ...base,
          headline: "Make your first move",
          body: "You're verified and have full access. Express interest in a company or open a conversation to start building your track record.",
          action: { label: "Browse the marketplace", href: "/investor/opportunities" },
          scoreHint: "Engaging founders builds your Partner Score's follow-through and responsiveness.",
        };
      }
      return {
        ...base,
        headline: "Keep engaging founders",
        body: "Reply promptly and follow through on the deals you're interested in — that's what builds a strong Partner Score.",
        action: { label: "Open your messages", href: "/investor/messages" },
        scoreHint: "Responsiveness and follow-through are 60% of your Partner Score.",
      };
    }

    case "manage": {
      return {
        ...base,
        headline: "Track your commitments",
        body: "Stay on top of pledge status, closings, and document requests across your active deals and portfolio.",
        action: { label: "Open your portfolio", href: "/investor/portfolio" },
      };
    }
  }
}

const SYSTEM_PROMPT = `You are a supportive coach guiding an investor through their next step on iCapOS.

Rewrite the provided next-step into one warm, concise sentence (max 2 sentences).

Rules:
- Use ONLY the provided headline and detail — do not invent numbers, outcomes, or guarantees.
- Never promise results. Keep it about the action.
- Plain prose only, no markdown, no lists.`;

/**
 * Hybrid coach: deterministic step is the source of truth; an optional Haiku
 * layer phrases the body warmly. Falls back to the deterministic body.
 */
export async function coachInvestorStage(input: InvestorCoachInput): Promise<InvestorStageCoach> {
  const step = buildInvestorStageCoach(input);

  if (!isClaudeConfigured()) return step;

  try {
    const stageLabel = INVESTOR_STAGE_META[input.stage].label;
    const text = await claudeComplete(
      [
        {
          role: "user",
          content: `Stage: ${stageLabel}\nNext step: ${step.headline}\nDetail: ${step.body}${
            step.scoreHint ? `\nScore note: ${step.scoreHint}` : ""
          }`,
        },
      ],
      { model: CLAUDE_HAIKU, maxTokens: 140, system: SYSTEM_PROMPT },
    );
    const body = text.trim();
    if (!body) return step;
    return { ...step, body, source: "ai" };
  } catch {
    return step;
  }
}
