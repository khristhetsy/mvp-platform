import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { buildClassAssistantReply } from "@/lib/learning/class-assistant";
import { findCourseLesson, getCourseBySlug } from "@/lib/learning/courses";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug : null;
  const lessonSlug = typeof body.lessonSlug === "string" ? body.lessonSlug : null;
  const message = typeof body.message === "string" ? body.message : "";

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json({ error: "Missing course or lesson." }, { status: 400 });
  }

  const course = getCourseBySlug(courseSlug);
  const found = course ? findCourseLesson(course, lessonSlug) : null;
  if (!course || !found) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const result = buildClassAssistantReply({
    message,
    lessonTitle: found.lesson.title,
    lessonContent: found.lesson.content,
    keyPoints: found.lesson.keyPoints,
  });

  return NextResponse.json(result);
}
