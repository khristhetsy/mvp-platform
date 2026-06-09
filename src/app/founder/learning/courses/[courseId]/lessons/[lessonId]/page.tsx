import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { FounderAdminLessonClient } from "@/components/founder/learning/FounderAdminLessonClient";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getPublishedAdminCourse, getPublishedAdminLesson } from "@/lib/learning/admin-courses";
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

  const [course, lesson] = await Promise.all([getPublishedAdminCourse(courseId), getPublishedAdminLesson(lessonId)]);
  if (!course || !lesson) notFound();

  const courseSlug = `admin-${courseId}`;
  const lessonSlug = lesson.lesson_key;

  const videoAsset = await getLessonVideoAsset({
    founderId: profile.id,
    companyId: company.id,
    courseSlug,
    lessonSlug,
  });

  const [signedVideoUrl, signedSlideDeckUrl] = await Promise.all([
    resolveLessonVideoPlaybackUrl(lesson.video_url ?? videoAsset?.video_url, lesson.video_render_status ?? videoAsset?.render_status ?? "draft"),
    lesson.slide_deck_url ? createCourseSlideSignedUrl(lesson.slide_deck_url) : Promise.resolve(null),
  ]);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company.company_name}>
      <FounderFeatureGate featureKey="elearning">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Admin-authored lesson"
            title={lesson.title}
            description="Educational content only. No investment, legal, or tax advice."
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

          <WorkspacePanel title="Lesson" subtitle={`${lesson.estimated_time_minutes} minutes estimated`}>
            <FounderAdminLessonClient
              courseId={courseId}
              lessonId={lessonId}
              moduleSlug={lesson.module_slug}
              lessonKey={lesson.lesson_key}
              courseSlug={courseSlug}
              lessonSlug={lessonSlug}
              lessonContent={lesson.body_markdown}
              videoUrl={signedVideoUrl ?? undefined}
              slideDeckUrl={signedSlideDeckUrl ?? undefined}
              initialPositionSeconds={videoAsset?.watch_position_seconds}
              slides={videoAsset?.slides_json}
            />
          </WorkspacePanel>
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
