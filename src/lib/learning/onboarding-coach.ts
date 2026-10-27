import type { PersonalCoachContext } from "@/lib/learning/class-assistant";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";

// The steps a founder must finish to complete onboarding. Documents (pitch deck) and the later steps
// are optional here, matching computeFounderOnboardingProgress.
const REQUIRED_STEPS = [
  { id: "company_profile", title: "Company profile", hint: "Company name, industry, country, and a short description of what you build (at least 20 characters)." },
  { id: "funding_information", title: "Funding information", hint: "Pick the funding band that fits how much you are raising." },
] as const;

export const ONBOARDING_QUICK_PROMPTS = [
  "What is left to finish?",
  "What goes in my company profile?",
  "How do I pick my funding amount?",
];

function stepLines(progress: FounderOnboardingProgress) {
  return REQUIRED_STEPS.map((s) => `${progress.steps[s.id].completed ? "Done" : "Open"}: ${s.title}`);
}

function nextOpenStep(progress: FounderOnboardingProgress) {
  return REQUIRED_STEPS.find((s) => !progress.steps[s.id].completed) ?? null;
}

export function buildOnboardingFallbackReply(progress: FounderOnboardingProgress): string {
  const next = nextOpenStep(progress);
  if (!next) {
    return "Your required onboarding steps are done. You can upload a pitch deck any time, but it is optional for onboarding.";
  }
  return `Next step: ${next.title}. ${next.hint} Fill it in on this page, then check it before you continue.`;
}

export function buildOnboardingCoachContext(input: {
  founderName: string;
  companyName: string | null;
  progress: FounderOnboardingProgress;
}): PersonalCoachContext {
  const { progress } = input;
  const next = nextOpenStep(progress);
  const addendum = [
    "ONBOARDING MODE: you are guiding this founder through iCapOS onboarding on /founder/onboarding.",
    "The only required steps are Company profile and Funding information. The pitch deck and documents are optional for onboarding.",
    `Step status:\n${stepLines(progress).map((l) => `- ${l}`).join("\n")}`,
    next ? `Current step: ${next.title}. ${next.hint}` : "All required steps are done. Tell the founder they can continue to their workspace.",
    "Ask at most one question at a time. Keep replies under 80 words, in plain words.",
    "You cannot fill in or save any field. The founder enters and confirms every value themselves. Say which field to use and why it matters.",
    "Never invent facts about the company. If the founder is unsure of a number, tell them to enter their best current figure and update it later.",
    "Do not mention a required pitch deck. Do not give legal, tax, securities, or investment advice.",
  ].join("\n");

  return {
    founderName: input.founderName,
    companyName: input.companyName,
    courseTitle: "Founder onboarding",
    courseDescription: "Guided help to finish the required onboarding steps in iCapOS.",
    courseCategory: "Onboarding",
    courseLevel: "Getting started",
    whatYouWillLearn: REQUIRED_STEPS.map((s) => `${s.title}: ${s.hint}`),
    lessonTitle: next?.title ?? null,
    lessonContent: null,
    lessonKeyPoints: [],
    courseProgressPercent: progress.percent,
    nextStudySuggestion: next ? `${next.title} (/founder/onboarding)` : null,
    curriculumOutline: REQUIRED_STEPS.map((s) => `- ${s.title}`).join("\n"),
    gapBasedRecommendations: [],
    coachAddendum: addendum,
    fallbackReply: buildOnboardingFallbackReply(progress),
  };
}
