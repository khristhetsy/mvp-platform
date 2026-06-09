import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getModuleContent } from "@/lib/learning/modules";
import type { LearningLesson, LearningModuleContent } from "@/lib/learning/types";

type LessonContentOverrideRow = {
  module_slug: string;
  lesson_id: string;
  title: string | null;
  summary: string | null;
  key_points: string[] | null;
  worksheet_prompt: string | null;
};

export async function listLessonContentOverrides(moduleSlug: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_lesson_content")
    .select("module_slug, lesson_id, title, summary, key_points, worksheet_prompt")
    .eq("module_slug", moduleSlug);

  if (error) {
    return [] as LessonContentOverrideRow[];
  }

  return (data ?? []) as LessonContentOverrideRow[];
}

function mergeLesson(base: LearningLesson, override: LessonContentOverrideRow | undefined): LearningLesson {
  if (!override) return base;

  return {
    ...base,
    title: override.title ?? base.title,
    summary: override.summary ?? base.summary,
    keyPoints: override.key_points?.length ? override.key_points : base.keyPoints,
    worksheetPrompt: override.worksheet_prompt ?? base.worksheetPrompt,
  };
}

export async function getModuleContentWithOverrides(slug: string): Promise<LearningModuleContent | null> {
  const base = getModuleContent(slug);
  if (!base) return null;

  const overrides = await listLessonContentOverrides(slug);
  if (overrides.length === 0) return base;

  const overrideByLessonId = new Map(overrides.map((row) => [row.lesson_id, row]));

  return {
    ...base,
    lessons: base.lessons.map((lesson) => mergeLesson(lesson, overrideByLessonId.get(lesson.id))),
  };
}

export async function upsertLessonContentOverride(input: {
  moduleSlug: string;
  lessonId: string;
  title?: string | null;
  summary?: string | null;
  keyPoints?: string[] | null;
  worksheetPrompt?: string | null;
  updatedBy: string;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const payload = {
    module_slug: input.moduleSlug,
    lesson_id: input.lessonId,
    title: input.title ?? null,
    summary: input.summary ?? null,
    key_points: input.keyPoints ?? null,
    worksheet_prompt: input.worksheetPrompt ?? null,
    updated_by: input.updatedBy,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("learning_lesson_content")
    .upsert(payload, { onConflict: "module_slug,lesson_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save lesson content override.");
  }

  return data;
}
