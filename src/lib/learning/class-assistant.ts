import OpenAI from "openai";
import { findContinueCourseLesson } from "@/lib/learning/course-progress";
import {
  findCourseLesson,
  flattenCourseLessons,
  FOUNDER_COURSES,
  getCourseBySlug,
} from "@/lib/learning/courses";
import type { Course, CourseLesson } from "@/lib/learning/course-types";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

export const COACH_DISCLAIMER =
  "CapitalOS provides educational support only. This is not legal, tax, investment, securities, or fundraising advice.";

export const QUIZ_REFUSAL_REPLY =
  "I can't give the quiz answer directly, but I can explain the concept so you can choose confidently.";

const QUIZ_ANSWER_PATTERN =
  /\b(quiz answer|correct answer|right answer|which option|what is the answer|give me the answer|answer key|choose [a-d]\b|pick [a-d]\b|option [a-d]\b|letter [a-d]\b|tell me [a-d]\b)\b/i;

const ADVICE_PATTERN =
  /\b(should i invest|buy stock|sell shares|tax advice|legal advice|securities law|guaranteed funding|sec approved|sec compliance|investor approved|file form d|regulation d)\b/i;

export type CoachMessage = { role: "user" | "assistant"; content: string };

export type PersonalCoachContext = {
  founderName: string;
  companyName: string | null;
  courseTitle: string;
  courseDescription: string;
  courseCategory: string;
  courseLevel: string;
  whatYouWillLearn: string[];
  lessonTitle: string | null;
  lessonContent: string | null;
  lessonKeyPoints: string[];
  courseProgressPercent: number;
  nextStudySuggestion: string | null;
  curriculumOutline: string;
};

export type PersonalCoachResult = {
  reply: string;
  disclaimer: string;
  mode: "openai" | "fallback" | "guardrail";
};

export function isQuizAnswerRequest(message: string) {
  return QUIZ_ANSWER_PATTERN.test(message.trim());
}

export function isRestrictedAdviceRequest(message: string) {
  return ADVICE_PATTERN.test(message.trim());
}

export function buildCatalogCoachContext(input: {
  founderName: string;
  companyName: string | null;
  overallPercent: number;
  adminCurriculumOutline?: string | null;
}): PersonalCoachContext {
  const courses = FOUNDER_COURSES;
  const coreOutline = courses
    .map((c) => `- ${c.title} (/founder/learning/${c.slug}): ${c.description}`)
    .join("\n");
  const curriculumOutline = [coreOutline, input.adminCurriculumOutline?.trim()].filter(Boolean).join("\n");

  return {
    founderName: input.founderName,
    companyName: input.companyName,
    courseTitle: "CapitalOS Founder Academy",
    courseDescription:
      "Course catalog for educational founder training — investor readiness, pitch decks, financials, data rooms, governance, communication, and capital strategy. Admin-authored courses may also appear in your catalog when published.",
    courseCategory: "All categories",
    courseLevel: "All levels",
    whatYouWillLearn: [
      "Choose a course aligned to your current investor preparation gaps",
      "Build skills across pitch materials, diligence, and communication",
      "Track learning progress per course on the platform",
    ],
    lessonTitle: null,
    lessonContent: null,
    lessonKeyPoints: [],
    courseProgressPercent: input.overallPercent,
    nextStudySuggestion: courses[0]
      ? `Browse ${courses[0].title} at /founder/learning/${courses[0].slug}`
      : null,
    curriculumOutline,
  };
}

export function buildPersonalCoachContext(input: {
  course: Course;
  lesson: CourseLesson | null;
  sectionTitle: string | null;
  founderName: string;
  companyName: string | null;
  progressRows: FounderLessonProgressRecord[];
}): PersonalCoachContext {
  const flat = flattenCourseLessons(input.course);
  const completed = flat.filter(({ lesson }) =>
    input.progressRows.some(
      (r) =>
        r.module_slug === input.course.slug &&
        r.lesson_id === lesson.slug &&
        r.status === "completed",
    ),
  ).length;
  const percent = flat.length ? Math.round((completed / flat.length) * 100) : 0;
  const next = findContinueCourseLesson(input.course, input.progressRows);

  const curriculumOutline = input.course.sections
    .map((s) => {
      const items = s.lessons.map((l) => `  - ${l.title}${l.type === "quiz" ? " (quiz)" : ""}`).join("\n");
      return `${s.title}:\n${items}`;
    })
    .join("\n");

  return {
    founderName: input.founderName,
    companyName: input.companyName,
    courseTitle: input.course.title,
    courseDescription: input.course.description,
    courseCategory: input.course.category,
    courseLevel: input.course.level,
    whatYouWillLearn: input.course.whatYouWillLearn,
    lessonTitle: input.lesson?.title ?? null,
    lessonContent: input.lesson?.content ?? null,
    lessonKeyPoints: input.lesson?.keyPoints ?? [],
    courseProgressPercent: percent,
    nextStudySuggestion: next ? `${next.lesson.title} (${next.href})` : null,
    curriculumOutline,
  };
}

function buildSystemPrompt(ctx: PersonalCoachContext) {
  return `You are the CapitalOS AI Personal Coach for founder learning — an educational coach only.

SCOPE: Help founders with lesson concepts, startup education, investor readiness preparation, pitch decks, data rooms, governance basics, financial forecasting education, investor communication, fundraising preparation workflows, and CapitalOS platform navigation (/founder/documents, /founder/readiness, /founder/onboarding, /founder/settings, /founder/capital-raise, /founder/investors).

QUIZ RULES (STRICT):
- NEVER reveal correct quiz answers.
- NEVER say "choose A/B/C/D" or name a specific multiple-choice option as correct.
- NEVER complete quizzes for the user.
- If asked for quiz answers, respond ONLY with: "${QUIZ_REFUSAL_REPLY}" then explain the underlying concept.

COMPLIANCE (STRICT):
- No legal, tax, investment, or securities law advice.
- No fundraising guarantees, investor approval claims, or SEC compliance guarantees.
- Use educational framing: founder training, investor preparation, learning progress.

CONTEXT:
Founder: ${ctx.founderName}${ctx.companyName ? ` · Company: ${ctx.companyName}` : ""}
Course: ${ctx.courseTitle} (${ctx.courseCategory}, ${ctx.courseLevel})
Progress: ${ctx.courseProgressPercent}%
${ctx.lessonTitle ? `Current lesson: ${ctx.lessonTitle}` : "Viewing course overview (no specific lesson)."}
${ctx.nextStudySuggestion ? `Suggested next: ${ctx.nextStudySuggestion}` : ""}

What you will learn:
${ctx.whatYouWillLearn.map((w) => `- ${w}`).join("\n")}

Curriculum:
${ctx.curriculumOutline}
${ctx.lessonContent ? `\nCurrent lesson content:\n${ctx.lessonContent}` : ""}
${ctx.lessonKeyPoints.length ? `\nKey points:\n${ctx.lessonKeyPoints.map((p) => `- ${p}`).join("\n")}` : ""}

End every reply with a brief reminder that this is educational support only. Do not repeat the full disclaimer verbatim if already clear.`;
}

function sanitizeCoachReply(text: string, ctx: PersonalCoachContext) {
  const lower = text.toLowerCase();
  if (
    /\b(correct answer|choose option [a-d]|pick [a-d]|the answer is [a-d]|option [a-d] is correct)\b/i.test(
      lower,
    )
  ) {
    const concept = ctx.lessonKeyPoints[0] ?? ctx.lessonContent?.slice(0, 280) ?? ctx.courseDescription;
    return `${QUIZ_REFUSAL_REPLY}\n\nConcept to study: ${concept}`;
  }
  return text.trim();
}

export function buildFallbackCoachReply(input: {
  message: string;
  ctx: PersonalCoachContext;
}): string {
  const trimmed = input.message.trim();
  if (!trimmed) {
    return input.ctx.lessonTitle
      ? `Ask me about "${input.ctx.lessonTitle}" — I can explain concepts, why they matter for investor preparation, or what to study next.`
      : input.ctx.courseTitle.includes("Academy")
        ? "Browse courses in the catalog — ask which course to start, or get education on pitch decks, data rooms, and platform navigation."
        : `Ask me about "${input.ctx.courseTitle}" — I can explain the curriculum, suggest your next lesson, or help with pitch deck and data room education.`;
  }

  if (isRestrictedAdviceRequest(trimmed)) {
    return "I can only provide educational founder training. For legal, tax, securities, or investment decisions, consult qualified professionals. I can still explain general investor-readiness concepts.";
  }

  const lower = trimmed.toLowerCase();

  if (/\b(next|what should i study|continue|where to start)\b/i.test(lower) && input.ctx.nextStudySuggestion) {
    return `Based on your ${input.ctx.courseProgressPercent}% progress, consider continuing with: ${input.ctx.nextStudySuggestion}. Focus on applying concepts to your profile and document room.`;
  }

  if (/\b(pitch deck|deck)\b/i.test(lower)) {
    return "For pitch deck education: keep first-meeting decks to ~10–14 slides, lead with problem/solution/traction, align numbers with your data room, and upload the canonical PDF in /founder/documents. This is investor preparation training — not investment advice.";
  }

  if (/\b(data room|diligence|documents)\b/i.test(lower)) {
    return "Data room education: organize corporate, financial, product, and customer artifacts in /founder/documents; track gaps in /founder/readiness. Completeness reduces investor friction during diligence preparation.";
  }

  if (/\b(governance|board)\b/i.test(lower)) {
    return "Governance education: maintain board cadence, corporate records, and cap table hygiene in your document room. Consult counsel for entity-specific legal requirements.";
  }

  if (/\b(financial|forecast|projection)\b/i.test(lower)) {
    return "Financial education: build driver-based forecasts (customers, pricing, churn, COGS), document assumptions, and upload statements to your document room. Not tax or investment advice.";
  }

  if (/\b(investor update|communication|outreach)\b/i.test(lower)) {
    return "Investor communication education: use structured updates (metrics, milestones, risks) via /founder/capital-raise and manage outreach through /founder/investors. Factual tone builds trust.";
  }

  if (/\b(which course|what course|recommend course|start with)\b/i.test(lower)) {
    return `Course catalog:\n${input.ctx.curriculumOutline.slice(0, 900)}${input.ctx.curriculumOutline.length > 900 ? "…" : ""}\n\nPick a course page to get lesson-specific coaching.`;
  }

  if (/\b(navigate|where is|how do i|platform|capitalos)\b/i.test(lower)) {
    return "Platform navigation: courses (/founder/learning), documents (/founder/documents), readiness (/founder/readiness), onboarding (/founder/onboarding), settings (/founder/settings), capital raise (/founder/capital-raise), investors CRM (/founder/investors).";
  }

  if (input.ctx.lessonKeyPoints.length > 0) {
    const matched = input.ctx.lessonKeyPoints.find((p) =>
      lower.split(/\s+/).some((w) => w.length > 4 && p.toLowerCase().includes(w)),
    );
    if (matched) {
      return `On "${input.ctx.lessonTitle ?? input.ctx.courseTitle}": ${matched} Why it matters: investors use this signal in first-pass screening and diligence preparation — not as approval of your raise.`;
    }
  }

  if (input.ctx.lessonContent) {
    const excerpt =
      input.ctx.lessonContent.length > 400
        ? `${input.ctx.lessonContent.slice(0, 400)}…`
        : input.ctx.lessonContent;
    return `Here's the core idea from this lesson: ${excerpt} Tell me which part to unpack (screening, positioning, materials, or communication).`;
  }

  return `This course (${input.ctx.courseTitle}) covers: ${input.ctx.whatYouWillLearn.slice(0, 3).join("; ")}. Ask about a specific topic — pitch deck, data room, financials, governance, or your next lesson.`;
}

async function callOpenAICoach(ctx: PersonalCoachContext, message: string, history: CoachMessage[]) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = [
    { role: "system" as const, content: buildSystemPrompt(ctx) },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input,
  });

  return response.output_text?.trim() ?? "";
}

export async function runPersonalCoach(input: {
  message: string;
  ctx: PersonalCoachContext;
  history?: CoachMessage[];
}): Promise<PersonalCoachResult> {
  const disclaimer = COACH_DISCLAIMER;

  if (isQuizAnswerRequest(input.message)) {
    const concept =
      input.ctx.lessonKeyPoints[0] ??
      input.ctx.lessonContent?.slice(0, 300) ??
      input.ctx.whatYouWillLearn[0] ??
      input.ctx.courseDescription;
    return {
      reply: `${QUIZ_REFUSAL_REPLY}\n\n${concept}`,
      disclaimer,
      mode: "guardrail",
    };
  }

  if (isRestrictedAdviceRequest(input.message)) {
    return {
      reply:
        "I can only provide educational founder training on this platform. For legal, tax, securities, or investment decisions, consult qualified professionals. Ask me to explain investor-readiness concepts instead.",
      disclaimer,
      mode: "guardrail",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      reply: buildFallbackCoachReply({ message: input.message, ctx: input.ctx }),
      disclaimer,
      mode: "fallback",
    };
  }

  try {
    const raw = await callOpenAICoach(input.ctx, input.message, input.history ?? []);
    const reply = sanitizeCoachReply(raw || buildFallbackCoachReply({ message: input.message, ctx: input.ctx }), input.ctx);
    return { reply, disclaimer, mode: "openai" };
  } catch {
    return {
      reply: buildFallbackCoachReply({ message: input.message, ctx: input.ctx }),
      disclaimer,
      mode: "fallback",
    };
  }
}

/** @deprecated Use runPersonalCoach — kept for tests and direct imports */
export function buildClassAssistantReply(input: {
  message: string;
  lessonTitle: string;
  lessonContent: string;
  keyPoints?: string[];
}) {
  const ctx: PersonalCoachContext = {
    founderName: "Founder",
    companyName: null,
    courseTitle: "Course",
    courseDescription: "",
    courseCategory: "",
    courseLevel: "Beginner",
    whatYouWillLearn: [],
    lessonTitle: input.lessonTitle,
    lessonContent: input.lessonContent,
    lessonKeyPoints: input.keyPoints ?? [],
    courseProgressPercent: 0,
    nextStudySuggestion: null,
    curriculumOutline: "",
  };
  if (isQuizAnswerRequest(input.message)) {
    return {
      reply: `${QUIZ_REFUSAL_REPLY}\n\n${input.keyPoints?.[0] ?? input.lessonContent.slice(0, 200)}`,
      disclaimer: COACH_DISCLAIMER,
    };
  }
  return {
    reply: buildFallbackCoachReply({ message: input.message, ctx }),
    disclaimer: COACH_DISCLAIMER,
  };
}

export function resolveCoachLesson(courseSlug: string, lessonSlug: string | null) {
  const course = getCourseBySlug(courseSlug);
  if (!course) return null;
  if (!lessonSlug) {
    return { course, lesson: null as CourseLesson | null, sectionTitle: null as string | null };
  }
  const found = findCourseLesson(course, lessonSlug);
  if (!found) return null;
  return { course, lesson: found.lesson, sectionTitle: found.section.title };
}
