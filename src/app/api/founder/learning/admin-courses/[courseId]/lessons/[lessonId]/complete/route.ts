import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { getPublishedAdminCourse, getPublishedAdminLesson } from "@/lib/learning/admin-courses";
import { checkAndIssueAdminCourseCertificate } from "@/lib/learning/admin-course-certificates";

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ courseId: string; lessonId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { courseId, lessonId } = await params;
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const moduleSlug = typeof body.moduleSlug === "string" ? body.moduleSlug : null;
  const lessonKey = typeof body.lessonKey === "string" ? body.lessonKey : null;
  if (!moduleSlug || !lessonKey) {
    return NextResponse.json({ error: "moduleSlug and lessonKey are required." }, { status: 400 });
  }

  const [course, lesson] = await Promise.all([getPublishedAdminCourse(courseId), getPublishedAdminLesson(lessonId)]);
  if (!course || !lesson || lesson.module_slug !== moduleSlug || lesson.lesson_key !== lessonKey) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

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

  const { error } = await auth.supabase.from("founder_lesson_progress").upsert(
    {
      founder_id: auth.profile.id,
      company_id: company.id,
      module_slug: moduleSlug,
      lesson_id: lessonKey,
      status: "completed",
      completed_at: now,
      last_viewed_at: now,
    },
    { onConflict: "founder_id,company_id,module_slug,lesson_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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
  emitOperationalEvent(admin, {
    eventType: "learning_lesson_completed",
    eventCategory: "founder",
    entityType: "learning_course",
    entityId: courseId,
    actorUserId: auth.profile.id,
    actorRole: "founder",
    companyId: company.id,
    title: "Learning lesson completed",
    description: `Founder completed an admin-authored learning lesson (${lessonKey}).`,
    metadata: { course_id: courseId, module_slug: moduleSlug, lesson_key: lessonKey },
    sourceModule: "learning",
    visibility: "admin_only",
    dedupeKey: `learning_lesson_completed:${auth.profile.id}:${courseId}:${moduleSlug}:${lessonKey}`,
  });

  const cert = await checkAndIssueAdminCourseCertificate({
    courseId,
    founderId: auth.profile.id,
    companyId: company.id,
  });

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

  return NextResponse.json({ ok: true, certificateIssued: cert.issued });
}

