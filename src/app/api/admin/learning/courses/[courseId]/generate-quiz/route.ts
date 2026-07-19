/**
 * POST /api/admin/learning/courses/[courseId]/generate-quiz
 *
 * Admin-only. Generates (or regenerates) the course-scoped FINAL quiz for one
 * course from its existing published lessons. Does not touch lesson content.
 * The quiz gates completion (80% to pass, unlimited retries).
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { generateCourseQuiz } from "@/lib/learning/generate-course-quiz";
import { requireLearningStaff, ensureCanPublish, jsonBadRequest } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: Readonly<{ params: Promise<{ courseId: string }> }>,
) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error;
  try {
    ensureCanPublish(auth.profile);
  } catch (e) {
    return jsonBadRequest(e instanceof Error ? e.message : "Insufficient permissions.", 403);
  }

  const { courseId } = await params;
  try {
    const db = createServiceRoleClient();
    const result = await generateCourseQuiz(db, courseId, { createdBy: auth.profile.id });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return jsonBadRequest(e instanceof Error ? e.message : "Quiz generation failed.");
  }
}
