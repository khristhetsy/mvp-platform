import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { getPublishedAdminCourse, getPublishedCourseQuiz, listPublishedQuizQuestionsPublic } from "@/lib/learning/admin-courses";
import { FounderAdminCourseQuizClient } from "@/components/founder/learning/FounderAdminCourseQuizClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function FounderAdminCourseQuizPage({ params }: PageProps) {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { courseId } = await params;
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) notFound();

  const course = await getPublishedAdminCourse(courseId);
  if (!course) notFound();

  const quiz = await getPublishedCourseQuiz(courseId);
  if (!quiz) notFound();

  const questions = await listPublishedQuizQuestionsPublic(quiz.id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <div className="space-y-6">
          <PageHeader
            eyebrow={t("course_quiz")}
            title={quiz.title}
            description={t("educational_quiz_answers_are_graded_server_sid")}
            actions={
              <Link
                href={`/founder/learning/courses/${courseId}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to course
              </Link>
            }
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Educational content only. No investment, legal, or tax advice. No guarantee of funding outcomes.
          </div>

          <WorkspacePanel title={t("quiz")} subtitle={`${questions.length} questions · passing ${quiz.passing_score}%`}>
            <FounderAdminCourseQuizClient courseId={courseId} quizId={quiz.id} questions={questions} retryLimit={quiz.retry_limit} />
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}

