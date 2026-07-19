/**
 * POST /api/admin/learning/backfill-quizzes
 *
 * Admin-only. Finds published courses that have no course-scoped quiz and
 * generates one for each (80% pass, unlimited retries). Lesson content is left
 * untouched. Returns a per-course result summary.
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { generateCourseQuiz } from "@/lib/learning/generate-course-quiz";
import { requireLearningStaff, ensureCanPublish, jsonBadRequest } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error;
  try {
    ensureCanPublish(auth.profile);
  } catch (e) {
    return jsonBadRequest(e instanceof Error ? e.message : "Insufficient permissions.", 403);
  }

  const db = createServiceRoleClient();

  const { data: courses } = await db
    .from("learning_programs")
    .select("id, title")
    .eq("is_published", true)
    .limit(200);

  const { data: existingQuizzes } = await db
    .from("learning_quizzes")
    .select("program_id")
    .eq("scope_type", "course");
  const hasQuiz = new Set((existingQuizzes ?? []).map((q: { program_id: string | null }) => q.program_id));

  const targets = (courses ?? []).filter((c: { id: string }) => !hasQuiz.has(c.id));

  const results: Array<{ courseId: string; title: string; ok: boolean; questionCount?: number; error?: string }> = [];
  for (const c of targets as Array<{ id: string; title: string }>) {
    try {
      const r = await generateCourseQuiz(db, c.id, { createdBy: auth.profile.id });
      results.push({ courseId: c.id, title: c.title, ok: true, questionCount: r.questionCount });
    } catch (e) {
      results.push({ courseId: c.id, title: c.title, ok: false, error: e instanceof Error ? e.message : "failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    coursesScanned: (courses ?? []).length,
    missingQuiz: targets.length,
    generated: results.filter((r) => r.ok).length,
    results,
  });
}
