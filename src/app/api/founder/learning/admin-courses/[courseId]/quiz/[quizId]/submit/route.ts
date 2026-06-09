import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { checkAndIssueAdminCourseCertificate } from "@/lib/learning/admin-course-certificates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ courseId: string; quizId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { courseId, quizId } = await params;
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const answersRaw = body.answers as unknown;
  const answers =
    answersRaw && typeof answersRaw === "object" ? (answersRaw as Record<string, number>) : ({} as Record<string, number>);

  const supabase = await createServerSupabaseClient();
  const { data: quiz, error: quizError } = await supabase
    .from("learning_quizzes")
    .select("id, title, passing_score, retry_limit, content_status, scope_type, program_id")
    .eq("id", quizId)
    .eq("scope_type", "course")
    .eq("program_id", courseId)
    .eq("content_status", "published")
    .maybeSingle();

  if (quizError || !quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  const { data: questions } = await supabase
    .from("learning_quiz_questions")
    .select("id, correct_option_index")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true })
    .limit(200);

  const q = (questions ?? []) as Array<{ id: string; correct_option_index: number }>;
  if (q.length === 0) return NextResponse.json({ error: "Quiz has no questions." }, { status: 400 });

  // Enforce retry limit if configured.
  const { data: existingAttempts } = await supabase
    .from("founder_quiz_attempts")
    .select("id")
    .eq("founder_id", auth.profile.id)
    .eq("company_id", company.id)
    .eq("module_slug", `course:${courseId}`)
    .eq("lesson_id", `quiz:${quizId}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const attemptsUsed = (existingAttempts ?? []).length;
  if (quiz.retry_limit != null && attemptsUsed >= quiz.retry_limit) {
    return NextResponse.json({ error: "Retry limit reached for this quiz." }, { status: 400 });
  }

  let correct = 0;
  for (const item of q) {
    const selected = answers[item.id];
    if (typeof selected === "number" && selected === item.correct_option_index) correct += 1;
  }

  const score = Math.round((correct / q.length) * 100);
  const passed = score >= Number(quiz.passing_score ?? 70);
  const now = new Date().toISOString();

  const { data: existingCourseProgress } = await auth.supabase
    .from("learning_course_progress")
    .select("id, status, started_at")
    .eq("founder_id", auth.profile.id)
    .eq("company_id", company.id)
    .eq("program_id", courseId)
    .maybeSingle();

  if (!existingCourseProgress?.id) {
    await auth.supabase.from("learning_course_progress").insert({
      founder_id: auth.profile.id,
      company_id: company.id,
      program_id: courseId,
      status: "in_progress",
      started_at: now,
      last_viewed_at: now,
      updated_at: now,
    });
  } else {
    await auth.supabase
      .from("learning_course_progress")
      .update({
        status: existingCourseProgress.status === "completed" ? "completed" : "in_progress",
        last_viewed_at: now,
        updated_at: now,
      })
      .eq("id", existingCourseProgress.id);
  }

  await auth.supabase.from("founder_quiz_attempts").insert({
    founder_id: auth.profile.id,
    company_id: company.id,
    module_slug: `course:${courseId}`,
    lesson_id: `quiz:${quizId}`,
    score,
    passed,
    answers: Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [key, typeof value === "number" ? String(value) : ""]),
    ),
  });

  const admin = createServiceRoleClient();
  if (!existingCourseProgress?.id) {
    emitOperationalEvent(admin, {
      eventType: "learning_course_started",
      eventCategory: "founder",
      entityType: "learning_course",
      entityId: courseId,
      actorUserId: auth.profile.id,
      actorRole: "founder",
      companyId: company.id,
      title: "Learning course started",
      description: "Founder started an admin-authored learning course.",
      metadata: { course_id: courseId },
      sourceModule: "learning",
      visibility: "admin_only",
      dedupeKey: `learning_course_started:${auth.profile.id}:${courseId}`,
    });
  }
  if (passed) {
    emitOperationalEvent(admin, {
      eventType: "learning_quiz_passed",
      eventCategory: "founder",
      entityType: "learning_course",
      entityId: courseId,
      actorUserId: auth.profile.id,
      actorRole: "founder",
      companyId: company.id,
      title: "Learning quiz passed",
      description: "Founder passed an admin-authored course quiz.",
      metadata: { course_id: courseId, quiz_id: quizId, score },
      sourceModule: "learning",
      visibility: "admin_only",
      dedupeKey: `learning_quiz_passed:${auth.profile.id}:${courseId}:${quizId}`,
    });
  }

  const cert = passed
    ? await checkAndIssueAdminCourseCertificate({ courseId, founderId: auth.profile.id, companyId: company.id })
    : { issued: false as const };

  if (cert.issued) {
    emitOperationalEvent(admin, {
      eventType: "learning_certificate_issued",
      eventCategory: "founder",
      entityType: "learning_course",
      entityId: courseId,
      actorUserId: auth.profile.id,
      actorRole: "founder",
      companyId: company.id,
      title: "Certificate of Completion issued",
      description: "Founder earned a Certificate of Completion for an admin-authored course.",
      metadata: { course_id: courseId, certificate_code: cert.code ?? null },
      sourceModule: "learning",
      visibility: "admin_only",
      dedupeKey: `learning_certificate_issued:${auth.profile.id}:${courseId}`,
    });

    await auth.supabase
      .from("learning_course_progress")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("founder_id", auth.profile.id)
      .eq("company_id", company.id)
      .eq("program_id", courseId);
  }

  const attemptsRemaining =
    quiz.retry_limit != null ? Math.max(0, quiz.retry_limit - (attemptsUsed + 1)) : null;

  const questionResults = q.map((item) => {
    const selected = answers[item.id];
    const correct = typeof selected === "number" && selected === item.correct_option_index;
    return { questionId: item.id, correct };
  });

  return NextResponse.json({
    score,
    passed,
    attemptsUsed: attemptsUsed + 1,
    attemptsRemaining,
    certificateIssued: cert.issued,
    questionResults,
  });
}

