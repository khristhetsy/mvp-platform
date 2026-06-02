import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPublishedAdminCourseModules, listPublishedAdminLessonsForModule, getPublishedCourseQuiz } from "@/lib/learning/admin-courses";

function randomCertificateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CERT-";
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function checkAndIssueAdminCourseCertificate(input: {
  courseId: string;
  founderId: string;
  companyId: string;
}): Promise<{ issued: boolean; code?: string }> {
  const supabase = await createServerSupabaseClient();

  const [modules, quiz] = await Promise.all([
    listPublishedAdminCourseModules(input.courseId),
    getPublishedCourseQuiz(input.courseId),
  ]);

  const lessonKeys: Array<{ moduleSlug: string; lessonKey: string }> = [];
  for (const m of modules) {
    const lessons = await listPublishedAdminLessonsForModule(m.slug);
    for (const l of lessons) {
      lessonKeys.push({ moduleSlug: m.slug, lessonKey: l.lesson_key });
    }
  }

  // No published lessons => no certificate issuance criteria yet.
  if (lessonKeys.length === 0) return { issued: false };

  const { data: progressRows } = await supabase
    .from("founder_lesson_progress")
    .select("module_slug, lesson_id, status")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("status", "completed")
    .limit(2000);

  const completed = new Set((progressRows ?? []).map((r) => `${r.module_slug}:${r.lesson_id}`));
  const allLessonsCompleted = lessonKeys.every((k) => completed.has(`${k.moduleSlug}:${k.lessonKey}`));

  if (!allLessonsCompleted) return { issued: false };

  let quizPassed = true;
  if (quiz) {
    const { data: attempts } = await supabase
      .from("founder_quiz_attempts")
      .select("passed")
      .eq("founder_id", input.founderId)
      .eq("company_id", input.companyId)
      .eq("module_slug", `course:${input.courseId}`)
      .eq("lesson_id", `quiz:${quiz.id}`)
      .order("created_at", { ascending: false })
      .limit(1);
    quizPassed = Boolean(attempts?.[0]?.passed);
  }

  if (!quizPassed) return { issued: false };

  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("learning_certificates")
    .select("id, certificate_code")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("program_id", input.courseId)
    .eq("status", "issued")
    .maybeSingle();

  if (existing?.id) return { issued: false };

  let code = randomCertificateCode();
  for (let i = 0; i < 3; i += 1) {
    const { data: dupe } = await admin
      .from("learning_certificates")
      .select("id")
      .eq("certificate_code", code)
      .maybeSingle();
    if (!dupe) break;
    code = randomCertificateCode();
  }

  const { error } = await admin.from("learning_certificates").insert({
    founder_id: input.founderId,
    company_id: input.companyId,
    program_id: input.courseId,
    certificate_title: "Certificate of Completion",
    certificate_code: code,
    status: "issued",
    issued_by: null,
    metadata: { source: "auto", course_id: input.courseId },
  });

  if (error) return { issued: false };
  return { issued: true, code };
}

