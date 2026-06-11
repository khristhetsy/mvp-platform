import { notFound, redirect } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderCourseLanding } from "@/components/FounderCourseLanding";
import { FounderLearningModuleViewer } from "@/components/FounderLearningModuleViewer";
import { FounderLearningProgramView } from "@/components/FounderLearningProgramView";
import { getProgramBySlug } from "@/lib/learning/catalog";
import { getCourseBySlug } from "@/lib/learning/courses";
import { loadFounderLearningWorkspace } from "@/lib/learning/load-founder-learning";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { getModuleContent } from "@/lib/learning/modules";
import {
  computeStageAccess,
  isModuleStageUnlocked,
} from "@/lib/learning/stage-access";
import { getLearningModuleBySlug, listLearningProgressForCompany, listPublishedLearningModules } from "@/lib/learning/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningSlugPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const profile = await requireRole(["founder"]);
  const { slug } = await params;
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    notFound();
  }

  const program = getProgramBySlug(slug);
  if (program) {
    const workspace = await loadFounderLearningWorkspace(profile);

    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle={company.company_name}
      >
        <FounderFeatureGate featureKey="elearning">
          <FounderLearningProgramView
            program={program}
            modules={workspace.modules}
            lessonProgress={workspace.lessonProgress}
            stageAccess={workspace.stageAccess}
          />
        </FounderFeatureGate>
      </FounderAppShell>
    );
  }

  const course = getCourseBySlug(slug);
  if (course) {
    const lessonProgress = await listLessonProgressForCompany(profile.id, company.id);

    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle={company.company_name}
      >
        <FounderFeatureGate featureKey="elearning">
          <FounderCourseLanding course={course} progressRows={lessonProgress} />
        </FounderFeatureGate>
      </FounderAppShell>
    );
  }

  const learningModule = await getLearningModuleBySlug(slug);
  const content = getModuleContent(slug);

  if (!learningModule || !content || !learningModule.is_published) {
    notFound();
  }

  const [publishedModules, moduleProgressRows] = await Promise.all([
    listPublishedLearningModules(),
    listLearningProgressForCompany(profile.id, company.id),
  ]);
  const stageAccess = computeStageAccess(publishedModules, moduleProgressRows);
  if (!isModuleStageUnlocked(learningModule.readiness_stage, stageAccess)) {
    redirect("/founder/learning");
  }

  const progress = moduleProgressRows.find((row) => row.module_id === learningModule.id) ?? null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company.company_name}
    >
      <FounderFeatureGate featureKey="elearning">
        <FounderLearningModuleViewer
          moduleId={learningModule.id}
          moduleSlug={learningModule.slug}
          title={learningModule.title}
          content={content}
          initialProgress={progress}
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
