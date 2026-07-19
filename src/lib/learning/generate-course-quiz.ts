/**
 * Generate (or regenerate) a COURSE-scoped quiz for an admin-authored course.
 *
 * A course-scoped quiz is what gates completion: the certificate/completion
 * logic requires all lessons done AND this quiz passed. Lesson-scoped quizzes
 * do not gate the course. This is used by:
 *   - the new-course generator (so new courses ship with a final quiz), and
 *   - the admin backfill action (to add a quiz + gate to existing courses
 *     without touching their lesson content).
 *
 * Policy: fixed 80% passing grade, unlimited retries (retry_limit = null).
 * Published immediately so the gate is active as soon as the course is published.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";

export const COURSE_QUIZ_PASSING_SCORE = 80;

type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

const SYSTEM_PROMPT =
  "You are an expert educator writing a rigorous final assessment for a startup-founder course. " +
  "Questions must test real understanding and application of the course material — not trivia or recall of exact wording. " +
  "Every question must be answerable from the provided lesson content, have exactly one correct option, and include three plausible distractors. " +
  "This is educational content only — never give legal, tax, securities, or investment advice. Return only valid JSON.";

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

async function loadCourseContent(
  db: SupabaseClient,
  courseId: string,
  includeUnpublished: boolean,
): Promise<{ title: string; lessons: Array<{ title: string; body: string }> } | null> {
  const { data: course } = await db
    .from("learning_programs")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return null;

  const { data: links } = await db
    .from("learning_program_modules")
    .select("module_id")
    .eq("program_id", courseId);
  const moduleIds = (links ?? []).map((l: { module_id: string }) => l.module_id).filter(Boolean);
  if (moduleIds.length === 0) return { title: (course as { title: string }).title, lessons: [] };

  let query = db
    .from("learning_lessons")
    .select("title, body_markdown, order_index, content_status")
    .in("module_id", moduleIds)
    .order("order_index", { ascending: true })
    .limit(200);
  if (!includeUnpublished) query = query.eq("content_status", "published");
  const { data: lessons } = await query;

  return {
    title: (course as { title: string }).title,
    lessons: (lessons ?? []).map((l: { title: string; body_markdown: string | null }) => ({
      title: l.title,
      body: l.body_markdown ?? "",
    })),
  };
}

/**
 * Create or replace the course-scoped quiz for a course. Returns the number of
 * questions written, or throws on a hard failure. Caller must have verified
 * admin/staff permission.
 */
export async function generateCourseQuiz(
  db: SupabaseClient,
  courseId: string,
  opts: { questionCount?: number; createdBy?: string | null; includeUnpublished?: boolean } = {},
): Promise<{ quizId: string; questionCount: number }> {
  if (!isClaudeConfigured()) {
    throw new Error("AI generation requires ANTHROPIC_API_KEY.");
  }

  const content = await loadCourseContent(db, courseId, opts.includeUnpublished ?? false);
  if (!content) throw new Error("Course not found.");
  if (content.lessons.length === 0) throw new Error("Course has no lessons to build a quiz from.");

  const questionCount = Math.min(10, Math.max(4, opts.questionCount ?? 6));
  const lessonBlocks = content.lessons
    .map((l, i) => `### Lesson ${i + 1}: ${l.title}\n${l.body.slice(0, 2500)}`)
    .join("\n\n")
    .slice(0, 24000);

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: `Course: "${content.title}"

Below is the full lesson content. Write a ${questionCount}-question multiple-choice FINAL quiz that a founder must pass to complete the course. Cover the most important concepts across all lessons, emphasise application over recall, and make the distractors plausible.

LESSON CONTENT:
${lessonBlocks}

Return ONLY valid JSON (no markdown fences):
{
  "questions": [
    {
      "prompt": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "explanation": "Why this answer is correct."
    }
  ]
}`,
      },
    ],
    { model: CLAUDE_SONNET, maxTokens: 3000, system: SYSTEM_PROMPT },
  );

  const parsed = parseJson<{ questions: GeneratedQuestion[] }>(raw);
  const questions = (parsed.questions ?? []).filter(
    (q) => q.prompt && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctOptionIndex === "number",
  );
  if (questions.length === 0) throw new Error("Quiz generation returned no valid questions.");

  const now = new Date().toISOString();

  // Replace any existing course-scoped quiz so re-runs don't duplicate.
  const { data: existing } = await db
    .from("learning_quizzes")
    .select("id")
    .eq("scope_type", "course")
    .eq("program_id", courseId);
  const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
  if (existingIds.length > 0) {
    await db.from("learning_quiz_questions").delete().in("quiz_id", existingIds);
    await db.from("learning_quizzes").delete().in("id", existingIds);
  }

  const { data: quiz, error: quizErr } = await db
    .from("learning_quizzes")
    .insert({
      scope_type: "course",
      program_id: courseId,
      module_id: null,
      lesson_id: null,
      title: `${content.title} — Final quiz`,
      passing_score: COURSE_QUIZ_PASSING_SCORE,
      retry_limit: null,
      content_status: "published",
      created_by: opts.createdBy ?? null,
      updated_by: opts.createdBy ?? null,
      updated_at: now,
    })
    .select("id")
    .single();

  if (quizErr || !quiz) throw new Error(quizErr?.message ?? "Failed to create quiz.");

  const rows = questions.map((q, i) => ({
    quiz_id: (quiz as { id: string }).id,
    order_index: i,
    prompt: q.prompt,
    options: q.options,
    correct_option_index: Math.min(Math.max(0, q.correctOptionIndex), q.options.length - 1),
    explanation: q.explanation ?? null,
    updated_at: now,
  }));
  const { error: qErr } = await db.from("learning_quiz_questions").insert(rows);
  if (qErr) throw new Error(qErr.message);

  return { quizId: (quiz as { id: string }).id, questionCount: rows.length };
}
