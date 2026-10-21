import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { CoachProgramExperience } from "@/components/coach/CoachProgramExperience";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachLesson } from "@/lib/learning/coach/courses";
import { MONDAY_REVIEW_SLUG } from "@/lib/learning/coach/program";
import { getModule, getProgram } from "@/lib/learning/coach/programs";
import { commitmentStreak, loadProgramRaw, metricValue, weekLine, whereYouStand } from "@/lib/learning/coach/program-reads";
import { recordLessonView } from "@/lib/learning/lesson-progress";
import { courseLessonHref } from "@/lib/learning/course-keys";

export const dynamic = "force-dynamic";

/**
 * The coached lesson page: milestone strip, this week line, where you stand, the coach thread on the
 * left and the live screen on the right. Only for founders the coach is active for; everyone else is
 * sent to the ordinary lesson page, which still works for this course.
 */
export default async function CoachedLessonPage({ params }: Readonly<{ params: Promise<{ courseSlug: string; lessonSlug: string }> }>) {
  const profile = await requireRole(["founder"]);
  const { courseSlug, lessonSlug } = await params;
  const program = getProgram(courseSlug);
  if (!program) notFound();

  const isReview = lessonSlug === MONDAY_REVIEW_SLUG;
  const mod = isReview ? null : getModule(program, lessonSlug);
  const found = isReview ? null : getCoachLesson(courseSlug, lessonSlug);
  if (!isReview && (!mod || !found)) notFound();

  const { company } = await getActiveCompanyForUser(profile);
  if (!company) notFound();

  const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient;
  const access = await getCoachAccess(supabase, { founderId: profile.id, companyId: company.id, courseSlug });
  if (!access.active) redirect(isReview ? "/founder/learning" : courseLessonHref(courseSlug, lessonSlug));

  if (found) {
    await recordLessonView({ founderId: profile.id, companyId: company.id, moduleSlug: courseSlug, lessonId: lessonSlug }).catch(() => undefined);
  }

  const raw = await loadProgramRaw({ profile, company, program });
  const streak = commitmentStreak(raw.commitments);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <CoachProgramExperience
          founderFirstName={(profile.full_name ?? "").split(" ")[0] || "there"}
          program={program}
          lessonSlug={lessonSlug}
          lesson={found ? { title: found.lesson.title, content: found.lesson.content, keyPoints: found.lesson.keyPoints ?? [], steps: found.steps } : null}
          tone={access.tone}
          initial={{
            raw,
            stand: whereYouStand(raw, program),
            weekLine: weekLine(raw, mod ? lessonSlug : program.modules[program.modules.length - 1].lessonSlug, program),
            streak,
            metric: mod ? metricValue(raw, mod.doMetric) : null,
            lastResolved: [...raw.commitments].reverse().find((c) => c.status === "kept" || c.status === "missed") ?? null,
          }}
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
