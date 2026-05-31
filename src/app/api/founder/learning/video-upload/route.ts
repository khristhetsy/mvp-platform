import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";
import {
  buildLearningVideoStoragePath,
  deleteLearningVideoObject,
  extensionForVideoMime,
  isHttpVideoUrl,
  LEARNING_VIDEO_MAX_BYTES,
  LEARNING_VIDEO_MIME_TYPES,
  resolveLessonVideoPlaybackUrl,
  uploadLearningVideoFile,
} from "@/lib/learning/video/learning-videos-storage";
import {
  clearManualLessonVideo,
  getLessonVideoAsset,
  upsertManualLessonVideo,
} from "@/lib/learning/video/lesson-video-assets";
import {
  ensureFounderCompanyForUser,
  userHasCompanyAccess,
} from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";

async function resolveVideoFounderId(companyId: string, profile: Profile) {
  if (profile.role === "founder") {
    return profile.id;
  }

  const admin = createServiceRoleClient();
  const { data: member } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return member?.user_id ?? profile.id;
}
async function resolveCompanyId(
  profile: { id: string; role: string },
  companyIdParam: string | null,
) {
  if (profile.role === "founder") {
    const company = await ensureFounderCompanyForUser(profile as Parameters<typeof ensureFounderCompanyForUser>[0]);
    if (!company) return { error: "Company not found.", status: 403 as const };
    return { companyId: company.id };
  }

  if (!companyIdParam) {
    return { error: "companyId is required for staff uploads.", status: 400 as const };
  }

  const staffRoles = new Set(["admin", "analyst"]);
  if (!staffRoles.has(profile.role)) {
    return { error: "Insufficient permissions.", status: 403 as const };
  }

  return { companyId: companyIdParam };
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder", "admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const rateLimited = await enforceRateLimit({
    bucket: "learning_video_upload",
    subjectId: auth.profile.id,
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const formData = await request.formData();
  const courseSlug = String(formData.get("courseSlug") ?? "").trim();
  const lessonSlug = String(formData.get("lessonSlug") ?? "").trim();
  const companyIdParam = String(formData.get("companyId") ?? "").trim() || null;
  const file = formData.get("file");

  if (!courseSlug || !lessonSlug || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const companyResult = await resolveCompanyId(auth.profile, companyIdParam);
  if ("error" in companyResult) {
    return NextResponse.json({ error: companyResult.error }, { status: companyResult.status });
  }

  if (auth.profile.role === "founder") {
    const hasAccess = await userHasCompanyAccess(auth.profile.id, companyResult.companyId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Company access denied." }, { status: 403 });
    }
  }

  const course = getCourseBySlug(courseSlug);
  const found = course ? findCourseLesson(course, lessonSlug) : null;
  if (!course || !found) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const mime = file.type || "video/mp4";
  if (!LEARNING_VIDEO_MIME_TYPES.has(mime)) {
    return NextResponse.json(
      { error: "Only video/mp4 and video/webm files are allowed." },
      { status: 400 },
    );
  }

  if (file.size > LEARNING_VIDEO_MAX_BYTES) {
    return NextResponse.json(
      { error: "Video exceeds the 250MB upload limit." },
      { status: 400 },
    );
  }

  const founderId = await resolveVideoFounderId(companyResult.companyId, auth.profile);
  const existing = await getLessonVideoAsset({
    founderId,
    companyId: companyResult.companyId,
    courseSlug,
    lessonSlug,
  }).catch(() => null);

  if (existing?.video_url && !isHttpVideoUrl(existing.video_url)) {
    try {
      await deleteLearningVideoObject(existing.video_url);
    } catch {
      // best-effort cleanup of prior object
    }
  }

  const ext = extensionForVideoMime(mime);
  const storagePath = buildLearningVideoStoragePath(
    companyResult.companyId,
    courseSlug,
    lessonSlug,
    `lesson.${ext}`,
  );

  try {
    await uploadLearningVideoFile({
      companyId: companyResult.companyId,
      storagePath,
      file,
      contentType: mime,
    });

    const asset = await upsertManualLessonVideo({
      founderId,
      companyId: companyResult.companyId,
      courseSlug,
      lessonSlug,
      storagePath,
    });

    const playbackUrl = await resolveLessonVideoPlaybackUrl(asset.video_url, asset.render_status);

    return NextResponse.json({ asset, playbackUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video upload failed.";
    if (message.toLowerCase().includes("bucket not found")) {
      return NextResponse.json(
        { error: "learning-videos storage bucket is not configured. Apply migration 0040." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile(["founder", "admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug.trim() : "";
  const companyIdParam =
    typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json({ error: "courseSlug and lessonSlug are required." }, { status: 400 });
  }

  const companyResult = await resolveCompanyId(auth.profile, companyIdParam);
  if ("error" in companyResult) {
    return NextResponse.json({ error: companyResult.error }, { status: companyResult.status });
  }

  if (auth.profile.role === "founder") {
    const hasAccess = await userHasCompanyAccess(auth.profile.id, companyResult.companyId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Company access denied." }, { status: 403 });
    }
  }

  const founderId = await resolveVideoFounderId(companyResult.companyId, auth.profile);
  const existing = await getLessonVideoAsset({
    founderId,
    companyId: companyResult.companyId,
    courseSlug,
    lessonSlug,
  });

  if (!existing?.video_url) {
    return NextResponse.json({ error: "No video to remove." }, { status: 404 });
  }

  if (!isHttpVideoUrl(existing.video_url)) {
    try {
      await deleteLearningVideoObject(existing.video_url);
    } catch {
      // continue clearing metadata
    }
  }

  const asset = await clearManualLessonVideo({
    founderId,
    companyId: companyResult.companyId,
    courseSlug,
    lessonSlug,
  });

  return NextResponse.json({ asset, playbackUrl: null });
}
