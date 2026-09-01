// Per-stage, step-by-step guides shown when a founder opens a stage.
// Each step points to the tool where the work happens, plus an AI action:
//   - kind "tool":      deep-links into an existing AI tool (rating, plan, deck…)
//   - kind "assistant": opens the global iCapOS Assistant pre-loaded with a prompt
//     (dispatched as window CustomEvent "icapos-assistant:ask").

export type StageGuideAi =
  | { kind: "tool"; href: string; label: string }
  | { kind: "assistant"; prompt: string; label?: string };

export type StageGuideStep = {
  title: string;
  desc: string;
  href: string;
  hrefLabel: string;
  ai: StageGuideAi;
};

export type StageGuide = {
  slug: string;
  stageLabel: string;
  title: string;
  intro: string;
  steps: StageGuideStep[];
};

export const STAGE_SLUGS = ["onboarding", "preparation", "marketing", "closing"] as const;
export type StageSlug = (typeof STAGE_SLUGS)[number];

const GUIDES: Record<StageSlug, StageGuide> = {
  onboarding: {
    slug: "onboarding",
    stageLabel: "Stage 1 – Onboarding",
    title: "Get set up",
    intro: "Tell us about your company so everything downstream — your rating, matches, and outreach — is built on the right facts.",
    steps: [
      {
        title: "Complete your company profile",
        desc: "Industry, stage, raise target, use of funds, and team. This is the backbone every other tool reads from.",
        href: "/founder/settings",
        hrefLabel: "Open company profile",
        ai: { kind: "assistant", prompt: "Help me complete my company profile for investors — what details matter most and how should I phrase them?" },
      },
      {
        title: "Review your progress",
        desc: "See what's done and what's next across all four stages at a glance.",
        href: "/founder/journey",
        hrefLabel: "Open My Progress",
        ai: { kind: "assistant", prompt: "Based on where I am, what should I focus on first to become investment-ready?" },
      },
      {
        title: "Publish your one-pager",
        desc: "The public summary investors see first. Make it sharp before you start outreach.",
        href: "/founder/preview",
        hrefLabel: "Open one-pager",
        ai: { kind: "assistant", prompt: "Review my one-pager and suggest improvements to make it more compelling to investors." },
      },
    ],
  },
  preparation: {
    slug: "preparation",
    stageLabel: "Stage 2 – Preparation",
    title: "Prepare your materials",
    intro: "Assemble the documents and get an honest read on how investable you are — then close the gaps before investors see you.",
    steps: [
      {
        title: "Get your Capital Readiness Rating",
        desc: "An AI assessment of how investable you are right now, with the specific gaps to fix.",
        href: "/founder/readiness/wizard",
        hrefLabel: "Open the rating wizard",
        ai: { kind: "tool", href: "/founder/readiness/wizard", label: "Run AI rating" },
      },
      {
        title: "Build your business plan",
        desc: "Draft a full plan with AI, section by section, from your company profile.",
        href: "/founder/business-plan",
        hrefLabel: "Open business plan",
        ai: { kind: "tool", href: "/founder/business-plan", label: "Draft with AI" },
      },
      {
        title: "Create your pitch deck",
        desc: "Generate an investor-ready deck and refine each slide.",
        href: "/founder/pitch-deck",
        hrefLabel: "Open pitch deck",
        ai: { kind: "tool", href: "/founder/pitch-deck", label: "Generate with AI" },
      },
      {
        title: "Complete your data room",
        desc: "Upload the documents investors expect. Missing items lower your rating.",
        href: "/founder/readiness/data-room",
        hrefLabel: "Open data room",
        ai: { kind: "assistant", prompt: "What documents am I missing in my data room, and which should I prioritize?" },
      },
      {
        title: "Run an AI diligence review",
        desc: "See the questions investors will ask — and how your materials answer them.",
        href: "/founder/report",
        hrefLabel: "Open diligence report",
        ai: { kind: "tool", href: "/founder/report", label: "Run AI review" },
      },
    ],
  },
  marketing: {
    slug: "marketing",
    stageLabel: "Stage 3 – Marketing",
    title: "Find investors & get in front of them",
    intro: "Match with the right investors, run outreach, present at events, and track what's converting.",
    steps: [
      {
        title: "Review your investor matches",
        desc: "See investors matched to your sector, stage, and raise — ranked by fit.",
        href: "/founder/matches",
        hrefLabel: "Open matches",
        ai: { kind: "assistant", prompt: "Which of my matched investors are the best fit for my raise, and why?" },
      },
      {
        title: "Launch automated outreach",
        desc: "AI-drafted, personalized intros to matched investors — you approve before anything sends.",
        href: "/founder/deploy",
        hrefLabel: "Open outreach",
        ai: { kind: "tool", href: "/founder/deploy", label: "Draft emails with AI" },
      },
      {
        title: "Work your investor CRM",
        desc: "Track every conversation and stage. Keep momentum with timely follow-ups.",
        href: "/founder/investor-pipeline",
        hrefLabel: "Open CRM",
        ai: { kind: "assistant", prompt: "Which investors in my pipeline should I follow up with next, and what should I say?" },
      },
      {
        title: "Present at an event",
        desc: "Apply to take the stage at an iCFO investor event and get in front of the room.",
        href: "/founder/events/present",
        hrefLabel: "Apply to present",
        ai: { kind: "assistant", prompt: "Help me prepare a short, compelling talk for an investor event based on my company." },
      },
      {
        title: "Analyze your conversion",
        desc: "See where investors drop off and what to improve in your funnel.",
        href: "/founder/analytics",
        hrefLabel: "Open analytics",
        ai: { kind: "assistant", prompt: "How can I improve my investor conversion rate based on my outreach and pipeline?" },
      },
    ],
  },
  closing: {
    slug: "closing",
    stageLabel: "Stage 4 – Closing",
    title: "Close the raise",
    intro: "Run diligence, pick your structure, and manage the round through to close — then keep investors updated.",
    steps: [
      {
        title: "Open your deal room",
        desc: "A secure space to run diligence with committed investors.",
        href: "/founder/deal-room",
        hrefLabel: "Open deal room",
        ai: { kind: "assistant", prompt: "How should I set up my deal room and what should I have ready for investor due diligence?" },
      },
      {
        title: "Choose your offering type",
        desc: "SAFE, priced round, Reg CF, or SPV — pick the structure that fits your raise.",
        href: "/founder/offering-type",
        hrefLabel: "Open offering type",
        ai: { kind: "assistant", prompt: "Which offering type fits my raise — SAFE, priced round, Reg CF, or SPV — and what are the trade-offs?" },
      },
      {
        title: "Set up an SPV or closing",
        desc: "Pool investors into a single vehicle and manage the closing checklist.",
        href: "/founder/spvs",
        hrefLabel: "Open SPVs",
        ai: { kind: "assistant", prompt: "Walk me through creating an SPV for my round and the steps to close." },
      },
      {
        title: "Send investor updates",
        desc: "Keep committed and prospective investors warm with AI-drafted updates.",
        href: "/founder/investor-update",
        hrefLabel: "Open updates",
        ai: { kind: "tool", href: "/founder/investor-update", label: "Draft update with AI" },
      },
      {
        title: "Track your milestones",
        desc: "Set and monitor the milestones you committed to — proof you're executing.",
        href: "/founder/milestones",
        hrefLabel: "Open milestones",
        ai: { kind: "assistant", prompt: "What milestones should I set and track after closing my round?" },
      },
    ],
  },
};

export function getStageGuide(slug: string): StageGuide | null {
  return (GUIDES as Record<string, StageGuide>)[slug] ?? null;
}

// All four stage guides in raise order. Powers the Help center ("How iCapOS works").
export function getAllStageGuides(): StageGuide[] {
  return STAGE_SLUGS.map((s) => GUIDES[s]);
}
