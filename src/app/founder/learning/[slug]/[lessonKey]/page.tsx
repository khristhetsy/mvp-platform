import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderClassLessonExperience } from "@/components/FounderClassLessonExperience";
import { FounderLessonViewer } from "@/components/FounderLessonViewer";
import {
  buildCourseCurriculumProgress,
  resolveCourseNavigation,
} from "@/lib/learning/course-progress";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";
import { decodeLessonKey, lessonHref } from "@/lib/learning/lesson-keys";
import {
  lessonProgressKey,
  listLessonProgressForCompany,
  progressByLessonKey,
  recordLessonView,
} from "@/lib/learning/lesson-progress";
import { resolveLessonContext } from "@/lib/learning/resolve-lesson";
import { getLessonVideoAsset } from "@/lib/learning/video/lesson-video-assets";
import { resolveLessonVideoPlaybackUrl } from "@/lib/learning/video/learning-videos-storage";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderLearningLessonPage({
  params,
}: Readonly<{ params: Promise<{ slug: string; lessonKey: string }> }>) {
  const profile = await requireRole(["founder"]);
  const { slug: courseSlug, lessonKey: lessonSlug } = await params;
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    notFound();
  }

  const course = getCourseBySlug(courseSlug);
  if (course) {
    const found = findCourseLesson(course, lessonSlug);
    if (!found) {
      notFound();
    }

    const progressRows = await listLessonProgressForCompany(profile.id, company.id);
    const progressMap = progressByLessonKey(progressRows);
    const lessonProgress =
      progressMap.get(lessonProgressKey(courseSlug, lessonSlug)) ?? null;

    await recordLessonView({
      founderId: profile.id,
      companyId: company.id,
      moduleSlug: courseSlug,
      lessonId: lessonSlug,
    });

    const nav = resolveCourseNavigation(course, lessonSlug);
    const curriculum = buildCourseCurriculumProgress(course, progressRows);
    const videoAsset = await getLessonVideoAsset({
      founderId: profile.id,
      companyId: company.id,
      courseSlug,
      lessonSlug,
    }).catch(() => null);
    const videoPlaybackUrl = videoAsset
      ? await resolveLessonVideoPlaybackUrl(videoAsset.video_url, videoAsset.render_status)
      : null;

    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle={company.company_name}
      >
        <FounderFeatureGate featureKey="elearning">
          <FounderClassLessonExperience
            course={course}
            lesson={found.lesson}
            sectionTitle={found.section.title}
            curriculum={curriculum}
            lessonIndex={nav.index}
            lessonTotal={nav.total}
            initialProgress={lessonProgress}
            prevHref={nav.prev?.href ?? null}
            nextHref={nav.next?.href ?? null}
            initialVideoAsset={videoAsset}
            companyId={company.id}
            initialVideoPlaybackUrl={videoPlaybackUrl}
          />
        </FounderFeatureGate>
      </FounderAppShell>
    );
  }

  const decoded = decodeLessonKey(lessonSlug);
  if (!decoded) {
    notFound();
  }

  const context = await resolveLessonContext(courseSlug, decoded.moduleSlug, decoded.lessonId);
  if (!context) {
    notFound();
  }

  const progressRows = await listLessonProgressForCompany(profile.id, company.id);
  const progressMap = progressByLessonKey(progressRows);
  const lessonProgress = progressMap.get(lessonProgressKey(decoded.moduleSlug, decoded.lessonId)) ?? null;

  await recordLessonView({
    founderId: profile.id,
    companyId: company.id,
    moduleSlug: decoded.moduleSlug,
    lessonId: decoded.lessonId,
  });

  const prevLesson = context.lessonIndex > 0 ? context.lessons[context.lessonIndex - 1] : null;
  const nextLesson =
    context.lessonIndex < context.lessons.length - 1 ? context.lessons[context.lessonIndex + 1] : null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company.company_name}
    >
      <FounderFeatureGate featureKey="elearning">
        <FounderLessonViewer
          programSlug={context.program.slug}
          programTitle={context.program.title}
          moduleSlug={context.module.slug}
          moduleTitle={context.module.title}
          lesson={context.lesson}
          lessonIndex={context.lessonIndex}
          lessonCount={context.lessons.length}
          lessonKey={lessonSlug}
          initialProgress={lessonProgress}
          prevHref={
            prevLesson
              ? lessonHref(context.program.slug, context.module.slug, prevLesson.id)
              : null
          }
          nextHref={
            nextLesson
              ? lessonHref(context.program.slug, context.module.slug, nextLesson.id)
              : null
          }
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
