import type { JourneyStage } from "@/lib/founder-journey/types";

export type TipAudience = "founder" | "investor";

/** Investor context buckets derived from the Partner Score. */
export type InvestorTipState = "new" | "low_responsiveness" | "low_followthrough" | "general";

export type Tip = {
  id: string;
  audience: TipAudience;
  /** Short chip label explaining why this tip is shown. */
  context: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  /** Founder tips may target a specific journey stage; omit for general. */
  founderStage?: JourneyStage;
  /** Investor tips may target a specific state; omit for general. */
  investorState?: InvestorTipState;
};

export const TIPS: Tip[] = [
  // ── Founder ─────────────────────────────────────────────────────────────
  {
    id: "f-initialize-profile",
    audience: "founder",
    context: "Initialize",
    founderStage: "initialize",
    body: "Complete every field in your company profile — it advances you automatically to Qualify, no review needed.",
    actionLabel: "Finish your profile",
    actionHref: "/founder/onboarding",
  },
  {
    id: "f-qualify-captable",
    audience: "founder",
    context: "Qualify",
    founderStage: "qualify",
    body: "Your cap table is one of three required documents. Uploading it is often the fastest step toward the 75% readiness threshold.",
    actionLabel: "Open Qualify",
    actionHref: "/founder/qualify",
  },
  {
    id: "f-deploy-warm",
    audience: "founder",
    context: "Deploy",
    founderStage: "deploy",
    body: "Investors who hear back the same week convert far better. Check your pipeline for anyone who's gone quiet and follow up.",
    actionLabel: "Open Deploy",
    actionHref: "/founder/deploy",
  },
  {
    id: "f-optimize-update",
    audience: "founder",
    context: "Optimize",
    founderStage: "optimize",
    body: "Committed investors expect a steady cadence. A short monthly update keeps momentum and signals a well-run raise.",
    actionLabel: "Send an update",
    actionHref: "/founder/capital-raise",
  },
  {
    id: "f-general-learning",
    audience: "founder",
    context: "Tip",
    body: "The learning modules are tailored to your current stage — a few minutes there often unblocks your next step.",
    actionLabel: "Browse learning",
    actionHref: "/founder/learning",
  },

  // ── Investor ────────────────────────────────────────────────────────────
  {
    id: "i-new-engage",
    audience: "investor",
    context: "Partner Score",
    investorState: "new",
    body: "Engage at least 3 founders to unlock your Partner Score. Browsing dealflow and opening conversations starts your track record.",
    actionLabel: "Browse dealflow",
    actionHref: "/investor/opportunities",
  },
  {
    id: "i-respond-fast",
    audience: "investor",
    context: "Partner Score",
    investorState: "low_responsiveness",
    body: "Founders value a fast reply. Responding to waiting messages within a couple of days strengthens your responsiveness and Partner Score.",
    actionLabel: "Open messages",
    actionHref: "/investor/messages",
  },
  {
    id: "i-followthrough",
    audience: "investor",
    context: "Partner Score",
    investorState: "low_followthrough",
    body: "Following through on the deals you've saved or shown interest in is the biggest driver of your Partner Score.",
    actionLabel: "Review watchlist",
    actionHref: "/investor/watchlist",
  },
  {
    id: "i-general-profile",
    audience: "investor",
    context: "Tip",
    body: "A clear thesis, preferred sectors, and check-size range help founders understand your fit — and strengthen your credibility.",
    actionLabel: "Update profile",
    actionHref: "/investor/settings",
  },
];
