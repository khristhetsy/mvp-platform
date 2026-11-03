// Per-stage, step-by-step guides for the investor workspace.
// Mirrors lib/founder/stage-guides.ts. Stage keys and unlock rules come from
// lib/investor-journey/stages.ts: approved profile -> verified KYC -> SPV commitment.

import { INVESTOR_STAGE_META, INVESTOR_STAGES, type InvestorStageKey } from "@/lib/investor-journey/stages";

export const INVESTOR_STAGE_SLUGS = ["onboarding", "verification", "access", "manage"] as const;
export type InvestorStageSlug = (typeof INVESTOR_STAGE_SLUGS)[number];

const SLUG_TO_KEY: Record<InvestorStageSlug, InvestorStageKey> = {
  onboarding: "onboard",
  verification: "verify",
  access: "access",
  manage: "manage",
};

/** Real account signals the guide reads. Built on the server by the page. */
export type InvestorGuideSignals = {
  profileComplete: boolean;
  approved: boolean;
  kycVerified: boolean;
  /** True once every required KYC document is uploaded (or KYC is already verified). */
  kycDocsComplete: boolean;
  watchlistCount: number;
  interestCount: number;
  introCount: number;
  hasCommitment: boolean;
};

export type StepDef = {
  title: string;
  desc: string;
  href: string;
  hrefLabel: string;
  prompt: string;
  /** Omit for steps with no completion signal (they stay "open"). */
  done?: (s: InvestorGuideSignals) => boolean;
  detail?: (s: InvestorGuideSignals) => string | null;
};

export type GateDef = {
  items: { label: string; met: (s: InvestorGuideSignals) => boolean }[];
};

export type GuideDef = {
  slug: InvestorStageSlug;
  intro: string;
  title: string;
  steps: StepDef[];
  gate: GateDef | null;
};

const GUIDES: Record<InvestorStageSlug, GuideDef> = {
  onboarding: {
    slug: "onboarding",
    title: "Set up your investor profile",
    intro:
      "Tell us what you invest in so your matches, deal alerts and introductions are built on the right facts. Submit it for approval to move on.",
    gate: { items: [{ label: "Investor profile approved", met: (s) => s.approved }] },
    steps: [
      {
        title: "Complete your investor profile",
        desc: "Investor type, thesis, sectors, geographies and contact preference. Matching reads from this.",
        href: "/investor/onboarding",
        hrefLabel: "Open profile",
        prompt: "Help me write a clear investment thesis and choose sectors for my investor profile.",
        done: (s) => s.profileComplete,
      },
      {
        title: "Submit for approval",
        desc: "Our team reviews every profile before deal flow opens. You will be notified when it is approved.",
        href: "/investor/onboarding",
        hrefLabel: "Review and submit",
        prompt: "What does the team look for when approving an investor profile?",
        done: (s) => s.approved,
      },
      {
        title: "Connect your calendar",
        desc: "Optional. Lets founders and the team book calls with you without back and forth.",
        href: "/investor/settings?tab=integrations",
        hrefLabel: "Open integrations",
        prompt: "How does connecting my calendar help me with introductions and meetings?",
      },
    ],
  },
  verification: {
    slug: "verification",
    title: "Verify who you are",
    intro:
      "Identity and accreditation checks keep every deal room compliant and let founders trust who they are talking to. Verification unlocks expressing interest, intros, SPVs and full data rooms.",
    gate: { items: [{ label: "Identity and accreditation verified", met: (s) => s.kycVerified }] },
    steps: [
      {
        title: "Upload your identity and accreditation documents",
        desc: "The checklist depends on your investor type. Required documents must all be uploaded.",
        href: "/investor/verification",
        hrefLabel: "Open verification",
        prompt: "Which documents do I need to verify my identity and accreditation, and what formats are accepted?",
        done: (s) => s.kycDocsComplete,
      },
      {
        title: "Wait for review",
        desc: "Our team reviews your documents. Once verified, deal access opens automatically.",
        href: "/investor/verification",
        hrefLabel: "Check status",
        prompt: "How long does investor verification usually take and what happens after it is approved?",
        done: (s) => s.kycVerified,
      },
    ],
  },
  access: {
    slug: "access",
    title: "Find and review deals",
    intro:
      "Browse the private market, save what interests you, express interest and request introductions. Committing to an SPV moves you into managing deals.",
    gate: { items: [{ label: "Commit to a deal through an SPV", met: (s) => s.hasCommitment }] },
    steps: [
      {
        title: "Review your top matches",
        desc: "Companies ranked against your thesis. They improve as you save deals and tell us what interests you.",
        href: "/investor/matches",
        hrefLabel: "Open matches",
        prompt: "Walk me through my top matches and which ones fit my thesis best.",
      },
      {
        title: "Save deals to your watchlist",
        desc: "Keep promising companies in one place and get notified of updates.",
        href: "/investor/watchlist",
        hrefLabel: "Open watchlist",
        prompt: "Help me compare the deals on my watchlist.",
        done: (s) => s.watchlistCount > 0,
        detail: (s) => (s.watchlistCount > 0 ? `${s.watchlistCount} saved` : null),
      },
      {
        title: "Express interest or request an introduction",
        desc: "Founders are notified and the deal moves into your Interest Pipeline.",
        href: "/investor/interest-pipeline",
        hrefLabel: "Open Interest Pipeline",
        prompt: "What should I say when I express interest or request an introduction to a founder?",
        done: (s) => s.interestCount + s.introCount > 0,
        detail: (s) => {
          const n = s.interestCount + s.introCount;
          return n > 0 ? `${n} active` : null;
        },
      },
      {
        title: "Open a deal room and start diligence",
        desc: "Review documents, ask questions and track diligence for the deals you pursue.",
        href: "/investor/deal-room",
        hrefLabel: "Open Deal Room",
        prompt: "Give me a diligence checklist for an early stage private deal.",
      },
      {
        title: "Commit through an SPV",
        desc: "A soft commitment or completed SPV participation moves you into Stage 4.",
        href: "/investor/spvs",
        hrefLabel: "Open SPVs and closings",
        prompt: "Explain how SPV participation and closings work for me as an investor.",
        done: (s) => s.hasCommitment,
      },
    ],
  },
  manage: {
    slug: "manage",
    title: "Manage your deals",
    intro: "Track what you own, follow closings and keep up with activity across every deal.",
    gate: null,
    steps: [
      {
        title: "Track your portfolio",
        desc: "Commitments, company updates and performance in one view.",
        href: "/investor/portfolio",
        hrefLabel: "Open portfolio",
        prompt: "Summarize my portfolio and flag anything that needs my attention.",
      },
      {
        title: "Follow SPVs and closings",
        desc: "Documents, funding steps and closing status for every SPV you joined.",
        href: "/investor/spvs",
        hrefLabel: "Open SPVs and closings",
        prompt: "What are the next steps for my SPV participations?",
      },
      {
        title: "Review recent activity",
        desc: "Updates, messages and changes across your deals.",
        href: "/investor/activity",
        hrefLabel: "Open Recent Activity",
        prompt: "What changed across my deals this week?",
      },
    ],
  },
};

export function getInvestorStageGuide(slug: string): GuideDef | null {
  return (INVESTOR_STAGE_SLUGS as readonly string[]).includes(slug) ? GUIDES[slug as InvestorStageSlug] : null;
}

export function getAllInvestorStageGuides() {
  return INVESTOR_STAGE_SLUGS.map((slug) => describeGuide(GUIDES[slug]));
}

function meta(guide: GuideDef) {
  return INVESTOR_STAGE_META[SLUG_TO_KEY[guide.slug]];
}

/** Static summary for the Help page (no account state). */
export function describeGuide(guide: GuideDef) {
  const m = meta(guide);
  return {
    slug: guide.slug,
    stageLabel: `Stage ${m.number} – ${m.label}`,
    title: guide.title,
    intro: guide.intro,
    stepTitles: guide.steps.map((s) => s.title),
  };
}

export type InvestorGuideStepState = "done" | "current" | "open" | "locked";

export type InvestorGuideView = {
  slug: InvestorStageSlug;
  stageNumber: number;
  stageLabel: string;
  title: string;
  intro: string;
  stageStatus: "complete" | "current" | "locked";
  percent: number | null;
  steps: {
    title: string;
    desc: string;
    href: string;
    hrefLabel: string;
    prompt: string;
    state: InvestorGuideStepState;
    detail: string | null;
  }[];
  gate: { nextLabel: string; cleared: boolean; items: { label: string; met: boolean }[] } | null;
};

/** Pure: turn the guide definition plus real signals into a plain, serialisable view. */
export function buildInvestorGuideView(
  guide: GuideDef,
  signals: InvestorGuideSignals,
  currentStage: InvestorStageKey,
): InvestorGuideView {
  const m = meta(guide);
  const currentIdx = INVESTOR_STAGES.indexOf(currentStage);
  const stageStatus: InvestorGuideView["stageStatus"] =
    m.index < currentIdx ? "complete" : m.index === currentIdx ? "current" : "locked";

  let currentAssigned = false;
  const steps = guide.steps.map((step) => {
    const isDone = stageStatus === "complete" ? Boolean(step.done) : step.done ? step.done(signals) : false;
    let state: InvestorGuideStepState;
    if (stageStatus === "locked") state = "locked";
    else if (isDone) state = "done";
    else if (step.done && !currentAssigned) {
      state = "current";
      currentAssigned = true;
    } else state = "open";
    const detail = isDone ? (step.detail?.(signals) ?? "Completed") : null;
    return {
      title: step.title,
      desc: step.desc,
      href: step.href,
      hrefLabel: step.hrefLabel,
      prompt: step.prompt,
      state,
      detail,
    };
  });

  const tracked = guide.steps.filter((s) => s.done).length;
  const doneTracked = steps.filter((s, i) => guide.steps[i].done && s.state === "done").length;
  const percent = tracked === 0 ? null : stageStatus === "complete" ? 100 : Math.round((doneTracked / tracked) * 100);

  const next = INVESTOR_STAGE_META[INVESTOR_STAGES[m.index + 1]];
  const gate =
    guide.gate && next
      ? {
          nextLabel: `Stage ${next.number}`,
          cleared: stageStatus === "complete",
          items: guide.gate.items.map((i) => ({ label: i.label, met: stageStatus === "complete" || i.met(signals) })),
        }
      : null;

  return {
    slug: guide.slug,
    stageNumber: m.number,
    stageLabel: `Stage ${m.number} – ${m.label}`,
    title: guide.title,
    intro: guide.intro,
    stageStatus,
    percent,
    steps,
    gate,
  };
}
