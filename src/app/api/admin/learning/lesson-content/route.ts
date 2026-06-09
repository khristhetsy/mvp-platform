import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";
import { getModuleContent } from "@/lib/learning/modules";
import { listLessonContentOverrides, upsertLessonContentOverride } from "@/lib/learning/lesson-content-overrides";

const overrideSchema = z.object({
  moduleSlug: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1).max(200).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
  keyPoints: z.array(z.string().min(1).max(500)).max(10).optional().nullable(),
  worksheetPrompt: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const moduleSlug = new URL(request.url).searchParams.get("moduleSlug");
  if (!moduleSlug) {
    return NextResponse.json({ error: "moduleSlug is required." }, { status: 400 });
  }

  const base = getModuleContent(moduleSlug);
  if (!base) {
    return NextResponse.json({ error: "Module content not found." }, { status: 404 });
  }

  const overrides = await listLessonContentOverrides(moduleSlug);
  const overrideByLessonId = new Map(overrides.map((row) => [row.lesson_id, row]));

  const lessons = base.lessons.map((lesson) => {
    const override = overrideByLessonId.get(lesson.id);
    return {
      lessonId: lesson.id,
      title: override?.title ?? lesson.title,
      summary: override?.summary ?? lesson.summary,
      keyPoints: override?.key_points?.length ? override.key_points : lesson.keyPoints,
      worksheetPrompt: override?.worksheet_prompt ?? lesson.worksheetPrompt ?? "",
      hasOverride: Boolean(override),
    };
  });

  return NextResponse.json({ moduleSlug, lessons });
}

export async function PUT(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const base = getModuleContent(parsed.data.moduleSlug);
  if (!base?.lessons.some((lesson) => lesson.id === parsed.data.lessonId)) {
    return NextResponse.json({ error: "Lesson not found in static curriculum." }, { status: 404 });
  }

  try {
    const row = await upsertLessonContentOverride({
      moduleSlug: parsed.data.moduleSlug,
      lessonId: parsed.data.lessonId,
      title: parsed.data.title,
      summary: parsed.data.summary,
      keyPoints: parsed.data.keyPoints,
      worksheetPrompt: parsed.data.worksheetPrompt,
      updatedBy: auth.profile.id,
    });
    return NextResponse.json({ override: row });
  } catch (error) {
    return jsonBadRequest(error);
  }
}
