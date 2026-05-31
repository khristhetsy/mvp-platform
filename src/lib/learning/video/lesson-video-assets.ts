import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { VideoProvider, VideoRenderStatus, VideoScriptBundle } from "@/lib/learning/video/video-types";
import type { FounderLessonVideoAssetRecord, VideoSlide } from "@/lib/learning/video/video-types";

function parseSlides(raw: unknown): VideoSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw as VideoSlide[];
}

export function mapVideoAssetRow(row: Record<string, unknown>): FounderLessonVideoAssetRecord {
  return {
    id: String(row.id),
    founder_id: String(row.founder_id),
    company_id: String(row.company_id),
    course_slug: String(row.course_slug),
    lesson_slug: String(row.lesson_slug),
    script: row.script != null ? String(row.script) : null,
    narration_text: row.narration_text != null ? String(row.narration_text) : null,
    captions: row.captions != null ? String(row.captions) : null,
    slides_json: parseSlides(row.slides_json),
    video_url: row.video_url != null ? String(row.video_url) : null,
    render_status: row.render_status as VideoRenderStatus,
    provider: row.provider as VideoProvider,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getLessonVideoAsset(input: {
  founderId: string;
  companyId: string;
  courseSlug: string;
  lessonSlug: string;
}) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("founder_lesson_video_assets")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("course_slug", input.courseSlug)
    .eq("lesson_slug", input.lessonSlug)
    .maybeSingle();

  return data ? mapVideoAssetRow(data as Record<string, unknown>) : null;
}

export async function upsertLessonVideoScript(input: {
  founderId: string;
  companyId: string;
  courseSlug: string;
  lessonSlug: string;
  bundle: VideoScriptBundle;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const payload = {
    founder_id: input.founderId,
    company_id: input.companyId,
    course_slug: input.courseSlug,
    lesson_slug: input.lessonSlug,
    script: input.bundle.script,
    narration_text: input.bundle.narrationText,
    captions: input.bundle.captions,
    slides_json: input.bundle.slides,
    provider: input.bundle.provider,
    render_status: "script_ready" as const,
    updated_at: now,
  };

  const { data: existing } = await admin
    .from("founder_lesson_video_assets")
    .select("id")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("course_slug", input.courseSlug)
    .eq("lesson_slug", input.lessonSlug)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from("founder_lesson_video_assets")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapVideoAssetRow(data as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from("founder_lesson_video_assets")
    .insert({ ...payload, created_at: now })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVideoAssetRow(data as Record<string, unknown>);
}

export async function updateLessonVideoRenderStatus(input: {
  founderId: string;
  companyId: string;
  courseSlug: string;
  lessonSlug: string;
  renderStatus: VideoRenderStatus;
  videoUrl?: string | null;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("founder_lesson_video_assets")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("course_slug", input.courseSlug)
    .eq("lesson_slug", input.lessonSlug)
    .maybeSingle();

  const patch = {
    render_status: input.renderStatus,
    video_url: input.videoUrl ?? existing?.video_url ?? null,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await admin
      .from("founder_lesson_video_assets")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapVideoAssetRow(data as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from("founder_lesson_video_assets")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      course_slug: input.courseSlug,
      lesson_slug: input.lessonSlug,
      slides_json: [],
      provider: "manual",
      created_at: now,
      ...patch,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVideoAssetRow(data as Record<string, unknown>);
}
