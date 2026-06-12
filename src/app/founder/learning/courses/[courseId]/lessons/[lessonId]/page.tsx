import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderAdminLessonClient } from "@/components/founder/learning/FounderAdminLessonClient";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import {
  getPublishedAdminCourse,
  getPublishedAdminLesson,
  listPublishedAdminCourseModules,
  listPublishedAdminLessonsForModule,
} from "@/lib/learning/admin-courses";
import { getLessonVideoAsset } from "@/lib/learning/video/lesson-video-assets";
import {
  createCourseSlideSignedUrl,
  resolveLessonVideoPlaybackUrl,
} from "@/lib/learning/video/learning-videos-storage";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string; lessonId: string }>;
};

export default async function FounderAdminLessonPage({ params }: PageProps) {
  const profile = await requireRole(["founder"]);
  const { courseId, lessonId } = await params;
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) notFound();

  const [course, lesson] = await Promise.all([
    getPublishedAdminCourse(courseId),
    getPublishedAdminLesson(lessonId),
  ]);
  if (!course || !lesson) notFound();

  const courseSlug = `admin-${courseId}`;
  const lessonSlug = lesson.lesson_key;

  const videoAsset = await getLessonVideoAsset({
    founderId: profile.id,
    companyId: company.id,
    courseSlug,
    lessonSlug,
  });

  const [signedVideoUrl, signedSlideDeckUrl, modules] = await Promise.all([
    resolveLessonVideoPlaybackUrl(
      lesson.video_url ?? videoAsset?.video_url,
      lesson.video_render_status ?? videoAsset?.render_status ?? "draft",
    ),
    lesson.slide_deck_url ? createCourseSlideSignedUrl(lesson.slide_deck_url) : Promise.resolve(null),
    listPublishedAdminCourseModules(courseId),
  ]);

  const sidebarModules: { title: string; lessons: { id: string; title: string; estimatedMinutes: number }[] }[] = [];
  for (const m of modules) {
    const lessons = await listPublishedAdminLessonsForModule(m.slug);
    sidebarModules.push({
      title: m.title,
      lessons: lessons.map((l) => ({ id: l.id, title: l.title, estimatedMinutes: l.estimated_time_minutes })),
    });
  }

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <FounderAdminLessonClient
          courseId={courseId}
          lessonId={lessonId}
          moduleSlug={lesson.module_slug}
          lessonKey={lesson.lesson_key}
          courseSlug={courseSlug}
          lessonSlug={lessonSlug}
          lessonTitle={lesson.title}
          estimatedMinutes={lesson.estimated_time_minutes}
          lessonContent={lesson.body_markdown}
          videoUrl={signedVideoUrl ?? undefined}
          slideDeckUrl={signedSlideDeckUrl ?? undefined}
          initialPositionSeconds={videoAsset?.watch_position_seconds}
          slides={videoAsset?.slides_json}
          courseTitle={course.title}
          sidebarModules={sidebarModules}
          currentLessonId={lessonId}
        />
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
