/**
 * POST /api/admin/learning/generate-course
 *
 * Admin-only. Uses Claude Sonnet to generate a complete course — outline pass
 * then parallel lesson-content pass — then creates all DB records in sequence:
 * learning_programs → learning_modules → learning_program_modules →
 * learning_lessons → (optional) learning_quizzes + learning_quiz_questions.
 *
 * Returns { courseId, courseSlug, moduleId, lessonCount, quizCount }.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireLearningStaff, ensureCanPublish, jsonBadRequest } from "../_shared";

export const dynamic = "force-dynamic";

// ─── Input schema ────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(3).max(200),
  readiness_focus: z.enum(["stage_0", "stage_1", "stage_2", "stage_3", "general"]),
  lessonCount: z.number().int().min(3).max(10).default(5),
  topicFocus: z.string().max(500).optional(),
  includeQuiz: z.boolean().default(true),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).default("intermediate"),
});

// ─── Types for Claude output ─────────────────────────────────────────────────

type OutlineLesson = {
  title: string;
  lessonKey: string;
  estimatedMinutes: number;
  learningObjective: string;
};

type CourseOutline = {
  description: string;
  category: string;
  difficulty: "introductory" | "intermediate" | "advanced";
  lessons: OutlineLesson[];
};

type QuizQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

type LessonContent = {
  bodyMarkdown: string;
  quiz?: { questions: QuizQuestion[] };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  stage_0: "Stage 0 — Foundation (pre-fundraise basics)",
  stage_1: "Stage 1 — Seed round (early-stage fundraising)",
  stage_2: "Stage 2 — Series A (institutional fundraising)",
  stage_3: "Stage 3 — Exit planning & execution",
  general:  "General (not tied to a specific stage)",
};

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ─── Pass 1: generate course outline ────────────────────────────────────────

async function generateOutline(params: {
  title: string;
  stage: string;
  lessonCount: number;
  topicFocus?: string;
  difficulty: string;
}): Promise<CourseOutline> {
  const stageLabel = STAGE_LABELS[params.stage] ?? params.stage;
  const topicNote = params.topicFocus
    ? `\n- Topic focus: ${params.topicFocus}`
    : "";

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: `Create an educational course outline for startup founders.

- Course title: ${params.title}
- Target stage: ${stageLabel}
- Difficulty: ${params.difficulty}
- Number of lessons: ${params.lessonCount}${topicNote}

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "description": "2-3 sentence course description for founders",
  "category": "one of: Fundraising, Strategy, Legal, Operations, Finance, Marketing",
  "difficulty": "${params.difficulty}",
  "lessons": [
    {
      "title": "Lesson title",
      "lessonKey": "unique-kebab-case-slug",
      "estimatedMinutes": 7,
      "learningObjective": "One sentence — what founders can do after this lesson"
    }
  ]
}`,
      },
    ],
    {
      model: CLAUDE_SONNET,
      maxTokens: 2000,
      system:
        "You are an expert educator creating institutional readiness curriculum for startup founders. Return only valid JSON — no markdown, no commentary.",
    },
  );

  return parseJson<CourseOutline>(raw);
}

// ─── Pass 2: generate each lesson's body + quiz ──────────────────────────────

async function generateLessonContent(
  lesson: OutlineLesson,
  courseTitle: string,
  stageLabel: string,
  includeQuiz: boolean,
): Promise<LessonContent> {
  const quizInstruction = includeQuiz
    ? `Also include a "quiz" field with 5 questions that test understanding and application.`
    : `Do not include a "quiz" field.`;

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: `Write the full content for one lesson in an educational course for startup founders.

Course: "${courseTitle}" (${stageLabel})
Lesson: "${lesson.title}"
Learning objective: ${lesson.learningObjective}

${quizInstruction}

Return ONLY valid JSON:
{
  "bodyMarkdown": "Full lesson text in markdown. Use ## for section headers, bullet lists, **bold** for key terms. 500–700 words of substantive, specific content — practical examples, not generic advice.",
  "quiz": {
    "questions": [
      {
        "prompt": "Question text?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctOptionIndex": 0,
        "explanation": "Brief explanation of why this answer is correct."
      }
    ]
  }
}`,
      },
    ],
    {
      model: CLAUDE_SONNET,
      maxTokens: 3000,
      system:
        "You are an expert educator writing educational lessons for startup founders. Content must be specific, practical, and actionable — not generic business advice. Return only valid JSON.",
    },
  );

  return parseJson<LessonContent>(raw);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth — admin only
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error;

  try {
    ensureCanPublish(auth.profile);
  } catch (e) {
    return jsonBadRequest(e instanceof Error ? e.message : "Insufficient permissions.", 403);
  }

  if (!isClaudeConfigured()) {
    return jsonBadRequest("AI generation requires ANTHROPIC_API_KEY.", 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid JSON body.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { title, readiness_focus, lessonCount, topicFocus, includeQuiz, difficulty } = parsed.data;
  const stageLabel = STAGE_LABELS[readiness_focus] ?? readiness_focus;

  // ── Pass 1: outline ──────────────────────────────────────────────────────
  let outline: CourseOutline;
  try {
    outline = await generateOutline({ title, stage: readiness_focus, lessonCount, topicFocus, difficulty });
  } catch (e) {
    return jsonBadRequest(
      `Outline generation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    );
  }

  // Clamp to requested count in case AI returned more/fewer
  outline.lessons = outline.lessons.slice(0, lessonCount);

  // ── Pass 2: lesson bodies + quizzes in parallel ──────────────────────────
  let contents: LessonContent[];
  try {
    contents = await Promise.all(
      outline.lessons.map((lesson) =>
        generateLessonContent(lesson, title, stageLabel, includeQuiz),
      ),
    );
  } catch (e) {
    return jsonBadRequest(
      `Lesson generation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    );
  }

  // ── Create DB records ────────────────────────────────────────────────────
  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  const baseSlug = toSlug(title);
  const uniqueSuffix = Date.now().toString(36);
  const courseSlug = `${baseSlug}-${uniqueSuffix}`.slice(0, 120);

  // 1. learning_programs (course)
  const { data: program, error: programErr } = await db
    .from("learning_programs")
    .insert({
      slug: courseSlug,
      title,
      description: outline.description,
      readiness_focus,
      category: outline.category ?? null,
      difficulty: outline.difficulty ?? difficulty,
      content_status: "draft",
      is_published: false,
      order_index: 0,
      updated_at: now,
    })
    .select("id, slug")
    .single();

  if (programErr || !program) {
    return jsonBadRequest(programErr?.message ?? "Failed to create course record.");
  }

  // 2. learning_modules
  const moduleSlug = `${courseSlug}-m1`.slice(0, 120);
  const totalMinutes = outline.lessons.reduce((s, l) => s + (l.estimatedMinutes ?? 7), 0);

  const { data: module, error: moduleErr } = await db
    .from("learning_modules")
    .insert({
      slug: moduleSlug,
      title,
      description: outline.description,
      category: outline.category ?? null,
      readiness_stage: readiness_focus,
      difficulty: outline.difficulty ?? difficulty,
      content_status: "draft",
      is_published: false,
      estimated_time_minutes: totalMinutes,
      order_index: 0,
      updated_at: now,
    })
    .select("id, slug")
    .single();

  if (moduleErr || !module) {
    return jsonBadRequest(moduleErr?.message ?? "Failed to create module record.");
  }

  // 3. learning_program_modules (link)
  await db.from("learning_program_modules").insert({
    program_id: program.id,
    module_id: module.id,
    order_index: 0,
  });

  // 4. learning_lessons + optional quizzes
  let lessonCreated = 0;
  let quizCreated = 0;

  for (let i = 0; i < outline.lessons.length; i++) {
    const lessonMeta = outline.lessons[i];
    const lessonContent = contents[i];
    if (!lessonMeta || !lessonContent) continue;

    const { data: lessonRow, error: lessonErr } = await db
      .from("learning_lessons")
      .insert({
        module_id: module.id,
        module_slug: module.slug,
        lesson_key: lessonMeta.lessonKey ?? `lesson-${i + 1}`,
        title: lessonMeta.title,
        body_markdown: lessonContent.bodyMarkdown,
        order_index: i,
        estimated_time_minutes: lessonMeta.estimatedMinutes ?? 7,
        content_status: "draft",
        created_by: auth.profile.id,
        updated_by: auth.profile.id,
        updated_at: now,
      })
      .select("id")
      .single();

    if (lessonErr || !lessonRow) continue;
    lessonCreated++;

    // Optional quiz
    if (includeQuiz && lessonContent.quiz?.questions?.length) {
      const { data: quiz, error: quizErr } = await db
        .from("learning_quizzes")
        .insert({
          scope_type: "lesson",
          program_id: program.id,
          module_id: module.id,
          lesson_id: lessonRow.id,
          title: `${lessonMeta.title} — Quiz`,
          passing_score: 70,
          retry_limit: null,
          content_status: "draft",
          created_by: auth.profile.id,
          updated_by: auth.profile.id,
          updated_at: now,
        })
        .select("id")
        .single();

      if (!quizErr && quiz) {
        const questions = lessonContent.quiz.questions.map((q, qi) => ({
          quiz_id: quiz.id,
          order_index: qi,
          prompt: q.prompt,
          options: q.options,
          correct_option_index: q.correctOptionIndex,
          explanation: q.explanation ?? null,
          updated_at: now,
        }));
        await db.from("learning_quiz_questions").insert(questions);
        quizCreated++;
      }
    }
  }

  return NextResponse.json(
    {
      courseId: program.id,
      courseSlug: program.slug,
      moduleId: module.id,
      lessonCount: lessonCreated,
      quizCount: quizCreated,
    },
    { status: 201 },
  );
}
