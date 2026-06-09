import { NextResponse } from "next/server";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  COURSE_SLIDES_BUCKET,
  LEARNING_VIDEO_MAX_BYTES,
  LEARNING_VIDEOS_BUCKET,
  createCourseSlideSignedUrl,
  createLearningVideoSignedUrl,
  uploadLearningVideoFile,
} from "@/lib/learning/video/learning-videos-storage";

const SLIDES_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const SLIDE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function buildAdminStoragePath(courseId: string, moduleSlug: string, lessonKey: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `admin/${courseId}/${moduleSlug}/${lessonKey}/${Date.now()}-${safeName}`;
}

async function findLesson(moduleSlug: string, lessonKey: string) {
  const admin = createServiceRoleClient();
  const { data: lesson } = await admin
    .from("learning_lessons")
    .select("id, video_url, slide_deck_url, video_render_status")
    .eq("module_slug", moduleSlug)
    .eq("lesson_key", lessonKey)
    .maybeSingle();

  return lesson;
}

export async function GET(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const moduleSlug = url.searchParams.get("moduleSlug");
  const lessonKey = url.searchParams.get("lessonKey");
  if (!courseId || !moduleSlug || !lessonKey) {
    return NextResponse.json({ error: "courseId, moduleSlug, and lessonKey are required." }, { status: 400 });
  }

  const lesson = await findLesson(moduleSlug, lessonKey);
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  let videoUrl: string | null = null;
  if (lesson.video_url) {
    videoUrl = (await createLearningVideoSignedUrl(lesson.video_url)) ?? lesson.video_url;
  }

  return NextResponse.json({
    renderStatus: lesson.video_render_status ?? "draft",
    videoUrl,
    slideDeckUrl: lesson.slide_deck_url,
  });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const form = await request.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const courseId = String(form.get("courseId") ?? "");
  const moduleSlug = String(form.get("moduleSlug") ?? "");
  const lessonKey = String(form.get("lessonKey") ?? "");

  if (!(file instanceof File) || !courseId || !moduleSlug || !lessonKey) {
    return NextResponse.json({ error: "file, courseId, moduleSlug, and lessonKey are required." }, { status: 400 });
  }
  if (type !== "video" && type !== "slides") {
    return NextResponse.json({ error: "type must be video or slides." }, { status: 400 });
  }

  const lesson = await findLesson(moduleSlug, lessonKey);
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const mime = file.type || "application/octet-stream";
  if (type === "video") {
    if (!VIDEO_MIMES.has(mime)) return NextResponse.json({ error: "Video must be MP4 or WebM." }, { status: 400 });
    if (file.size > LEARNING_VIDEO_MAX_BYTES) return NextResponse.json({ error: "Video exceeds 250MB limit." }, { status: 400 });
  } else {
    if (!SLIDE_MIMES.has(mime)) return NextResponse.json({ error: "Slides must be PDF or PPTX." }, { status: 400 });
    if (file.size > SLIDES_MAX_BYTES) return NextResponse.json({ error: "Slides exceed 50MB limit." }, { status: 400 });
  }

  const storagePath = buildAdminStoragePath(courseId, moduleSlug, lessonKey, file.name);
  const bucket = type === "video" ? LEARNING_VIDEOS_BUCKET : COURSE_SLIDES_BUCKET;

  await uploadLearningVideoFile({
    companyId: "admin",
    storagePath,
    file,
    contentType: mime,
    bucket,
  });

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const patch =
    type === "video"
      ? { video_url: storagePath, video_render_status: "ready", updated_at: now, updated_by: auth.profile.id }
      : { slide_deck_url: storagePath, updated_at: now, updated_by: auth.profile.id };

  const { error } = await admin.from("learning_lessons").update(patch).eq("id", lesson.id);
  if (error) return jsonBadRequest(error);

  const signedUrl =
    type === "video"
      ? await createLearningVideoSignedUrl(storagePath)
      : await createCourseSlideSignedUrl(storagePath);

  return NextResponse.json({
    url: signedUrl ?? storagePath,
    type,
    fileName: file.name,
    fileSize: file.size,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const courseId = url.searchParams.get("courseId");
  const moduleSlug = url.searchParams.get("moduleSlug");
  const lessonKey = url.searchParams.get("lessonKey");
  if (!type || !courseId || !moduleSlug || !lessonKey) {
    return NextResponse.json({ error: "type, courseId, moduleSlug, and lessonKey are required." }, { status: 400 });
  }

  const lesson = await findLesson(moduleSlug, lessonKey);
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const patch =
    type === "video"
      ? { video_url: null, video_render_status: "draft", updated_at: now, updated_by: auth.profile.id }
      : { slide_deck_url: null, updated_at: now, updated_by: auth.profile.id };

  const { error } = await admin.from("learning_lessons").update(patch).eq("id", lesson.id);
  if (error) return jsonBadRequest(error);

  return NextResponse.json({ ok: true });
}
