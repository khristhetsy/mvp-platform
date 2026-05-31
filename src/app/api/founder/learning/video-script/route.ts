import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";
import { generateLessonVideoScript } from "@/lib/learning/video/generate-script";
import { getLessonVideoAsset, upsertLessonVideoScript } from "@/lib/learning/video/lesson-video-assets";
import { VIDEO_LESSON_DISCLAIMER } from "@/lib/learning/video/video-types";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json({ error: "courseSlug and lessonSlug are required." }, { status: 400 });
  }

  const course = getCourseBySlug(courseSlug);
  const found = course ? findCourseLesson(course, lessonSlug) : null;
  if (!course || !found) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  try {
    const bundle = await generateLessonVideoScript(course, found.lesson);
    let asset;
    try {
      asset = await upsertLessonVideoScript({
        founderId: auth.profile.id,
        companyId: company.id,
        courseSlug,
        lessonSlug,
        bundle,
      });
    } catch {
      asset = {
        id: "session",
        founder_id: auth.profile.id,
        company_id: company.id,
        course_slug: courseSlug,
        lesson_slug: lessonSlug,
        script: bundle.script,
        narration_text: bundle.narrationText,
        captions: bundle.captions,
        slides_json: bundle.slides,
        video_url: null,
        render_status: "script_ready" as const,
        provider: bundle.provider,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      asset,
      disclaimer: VIDEO_LESSON_DISCLAIMER,
      openAiUsed: bundle.provider === "openai",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
  } catch (error) {
    const existing = await getLessonVideoAsset({
      founderId: auth.profile.id,
      companyId: company.id,
      courseSlug,
      lessonSlug,
    }).catch(() => null);

    if (existing?.script) {
      return NextResponse.json({
        asset: existing,
        disclaimer: VIDEO_LESSON_DISCLAIMER,
        warning: "Script generation failed; returning last saved script.",
      });
    }

    const message = error instanceof Error ? error.message : "Script generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
