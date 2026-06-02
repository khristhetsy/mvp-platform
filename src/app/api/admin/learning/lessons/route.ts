import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const lessonCreateSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  module_slug: z.string().min(3).max(200),
  lesson_key: z.string().min(1).max(200),
  title: z.string().min(3).max(200),
  body_markdown: z.string().max(200000).optional(),
  order_index: z.number().int().optional(),
  estimated_time_minutes: z.number().int().min(1).max(600).optional(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).default("draft"),
});

export async function GET(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const url = new URL(request.url);
  const moduleSlug = url.searchParams.get("moduleSlug");
  const query = auth.supabase
    .from("learning_lessons")
    .select("id, module_id, module_slug, lesson_key, title, order_index, estimated_time_minutes, content_status, updated_at")
    .order("order_index", { ascending: true })
    .limit(500);

  const { data, error } = moduleSlug ? await query.eq("module_slug", moduleSlug) : await query;
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ lessons: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = lessonCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = {
    ...parsed.data,
    module_id: parsed.data.module_id ?? null,
    body_markdown: parsed.data.body_markdown ?? "",
    order_index: parsed.data.order_index ?? 0,
    estimated_time_minutes: parsed.data.estimated_time_minutes ?? 10,
    created_by: auth.profile.id,
    updated_by: auth.profile.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_lessons").insert(payload).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ lesson: data });
}

