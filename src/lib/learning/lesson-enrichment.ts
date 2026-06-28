import type { LearningLesson, LearningModuleRecord, LearningQuizQuestion } from "@/lib/learning/types";

const MODULE_ACTIONS: Record<string, { label: string; description: string; href: string }> = {
  "investor-ready-company-profiles": {
    label: "Complete company profile",
    description: "Update onboarding and company settings for institutional screening.",
    href: "/founder/onboarding",
  },
  "writing-strong-company-descriptions": {
    label: "Revise company description",
    description: "Align narrative with deck and diligence materials.",
    href: "/founder/settings",
  },
  "pitch-deck-fundamentals": {
    label: "Upload pitch deck",
    description: "Add your latest investor-ready PDF to the document room.",
    href: "/founder/documents",
  },
  "financial-projections": {
    label: "Upload financial statements",
    description: "Add financial artifacts investors expect in diligence.",
    href: "/founder/documents",
  },
  "investor-materials": {
    label: "Review document room",
    description: "Confirm core diligence folders are populated.",
    href: "/founder/documents",
  },
  "due-diligence-preparation": {
    label: "Open readiness workspace",
    description: "Review readiness score and remediation priorities.",
    href: "/founder/readiness",
  },
  "investor-updates": {
    label: "Prepare investor update",
    description: "Draft your next institutional-style company update.",
    href: "/founder/capital-raise",
  },
  "investor-outreach": {
    label: "Open investor CRM",
    description: "Review outreach targets and controlled messaging.",
    href: "/founder/investors",
  },
  "governance-basics": {
    label: "Governance checklist",
    description: "Track governance remediation on your readiness plan.",
    href: "/founder/readiness",
  },
  "compliance-readiness": {
    label: "Review submission status",
    description: "Confirm marketplace review and disclosure posture.",
    href: "/founder/readiness",
  },
};

const LESSON_QUIZ_OVERRIDES: Record<string, LearningQuizQuestion[]> = {
  "pitch-deck-fundamentals__deck-structure": [
    {
      id: "q1",
      prompt: "What is the typical slide count range for an institutional first-meeting deck?",
      choices: [
        { id: "a", label: "3–5 slides" },
        { id: "b", label: "10–14 slides" },
        { id: "c", label: "30–40 slides" },
      ],
      correctChoiceId: "b",
    },
    {
      id: "q2",
      prompt: "Which section should clearly state capital deployment?",
      choices: [
        { id: "a", label: "Use of funds / ask" },
        { id: "b", label: "Team hobbies" },
        { id: "c", label: "Office photos only" },
      ],
      correctChoiceId: "a",
    },
  ],
  "investor-ready-company-profiles__profile-screening": [
    {
      id: "q1",
      prompt: "What do institutional investors evaluate in a first-pass profile scan?",
      choices: [
        { id: "a", label: "Sector, stage, traction, and thesis fit" },
        { id: "b", label: "Founder social media only" },
        { id: "c", label: "Office location exclusively" },
      ],
      correctChoiceId: "a",
    },
  ],
};

function defaultQuiz(lesson: LearningLesson, moduleSlug: string, lessonId: string): LearningLesson["quiz"] {
  const overrideKey = `${moduleSlug}__${lessonId}`;
  const questions =
    LESSON_QUIZ_OVERRIDES[overrideKey] ??
    (lesson.keyPoints.length >= 2
      ? [
          {
            id: "q1",
            prompt: `Which best reflects the core idea of "${lesson.title}"?`,
            choices: [
              { id: "a", label: lesson.keyPoints[0] ?? "Primary takeaway" },
              { id: "b", label: "Ignore investor materials until late stage" },
              { id: "c", label: "Use only informal metrics" },
            ],
            correctChoiceId: "a",
          },
          {
            id: "q2",
            prompt: "Platform readiness progress means:",
            choices: [
              { id: "a", label: "Improved investor preparation on iCapOS — not a legal certification" },
              { id: "b", label: "Guaranteed funding approval" },
              { id: "c", label: "SEC registration complete" },
            ],
            correctChoiceId: "a",
          },
        ]
      : []);

  if (questions.length === 0) return undefined;

  return { passingScore: 70, questions };
}

export function enrichLesson(
  lesson: LearningLesson,
  module: LearningModuleRecord,
  lessonIndex: number,
): LearningLesson {
  const moduleSlug = module.slug;
  const action = MODULE_ACTIONS[moduleSlug];
  const minutes = Math.max(8, Math.round(module.estimated_time_minutes / Math.max(1, lessonIndex + 1)));

  return {
    ...lesson,
    estimatedMinutes: lesson.estimatedMinutes ?? minutes,
    learningObjective:
      lesson.learningObjective ??
      lesson.summary.slice(0, 120) + (lesson.summary.length > 120 ? "…" : ""),
    takeaways: lesson.takeaways ?? lesson.keyPoints,
    founderAction: lesson.founderAction ?? (action ? { ...action } : undefined),
    relatedChecklist:
      lesson.relatedChecklist ??
      (module.related_remediation_category
        ? `${module.category} · ${module.related_remediation_category.replaceAll("_", " ")}`
        : module.category),
    readinessImpact: lesson.readinessImpact ?? {
      categories: [module.category, module.readiness_stage],
      points: 4,
      description:
        "Contributes to platform readiness progress and iCapOS readiness tier — not legal or investment certification.",
    },
    resourcePlaceholder:
      lesson.resourcePlaceholder ??
      "Template download available in a future release — use your document room in the meantime.",
    quiz: lesson.quiz ?? defaultQuiz(lesson, moduleSlug, lesson.id),
  };
}
