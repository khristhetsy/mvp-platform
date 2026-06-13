import { NextResponse } from "next/server";
import { isClaudeConfigured } from "@/lib/claude";
import { requireApiProfile } from "@/lib/api/auth";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";
import {
  getLessonVideoAsset,
  saveWatchPosition,
  updateLessonVideoRenderStatus,
} from "@/lib/learning/video/lesson-video-assets";
import { isHeyGenConfigured } from "@/lib/learning/video/providers/heygen";
import { isRemotionConfigured } from "@/lib/learning/video/providers/remotion";
import { VIDEO_LESSON_DISCLAIMER } from "@/lib/learning/video/video-types";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
  const positionSeconds = typeof body.positionSeconds === "number" ? body.positionSeconds : null;

  if (!courseSlug || !lessonSlug || positionSeconds == null) {
    return NextResponse.json({ error: "courseSlug, lessonSlug, and positionSeconds are required." }, { status: 400 });
  }

  await saveWatchPosition({
    founderId: auth.profile.id,
    companyId: company.id,
    courseSlug,
    lessonSlug,
    positionSeconds: Math.max(0, Math.floor(positionSeconds)),
  });

  return NextResponse.json({ ok: true });
}

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
  const action = typeof body.action === "string" ? body.action : "get";

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json({ error: "courseSlug and lessonSlug are required." }, { status: 400 });
  }

  const course = getCourseBySlug(courseSlug);
  const found = course ? findCourseLesson(course, lessonSlug) : null;
  if (!course || !found) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const base = {
    founderId: auth.profile.id,
    companyId: company.id,
    courseSlug,
    lessonSlug,
  };

  try {
    if (action === "prepare_video") {
      const existing = await getLessonVideoAsset(base);
      if (!existing?.script) {
        return NextResponse.json(
          { error: "Generate a script before preparing video." },
          { status: 400 },
        );
      }

      const asset = await updateLessonVideoRenderStatus({
        ...base,
        renderStatus: "rendering",
        videoUrl: null,
      });

      return NextResponse.json({
        asset,
        disclaimer: VIDEO_LESSON_DISCLAIMER,
        message:
          "Video render queue placeholder — Phase 1 stores rendering status only. Real MP4 delivery in Phase 2.",
        providers: {
          remotion: isRemotionConfigured(),
          heygen: isHeyGenConfigured(),
          claude: isClaudeConfigured(),
        },
      });
    }

    const asset =
      (await getLessonVideoAsset(base)) ??
      (await updateLessonVideoRenderStatus({ ...base, renderStatus: "draft" }));

    return NextResponse.json({
      asset,
      disclaimer: VIDEO_LESSON_DISCLAIMER,
      providers: {
        remotion: isRemotionConfigured(),
        heygen: isHeyGenConfigured(),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
        claude: isClaudeConfigured(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video metadata update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
