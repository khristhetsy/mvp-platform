import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const lessonUpdateSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  module_slug: z.string().min(3).max(200).optional(),
  lesson_key: z.string().min(1).max(200).optional(),
  title: z.string().min(3).max(200).optional(),
  body_markdown: z.string().max(200000).optional(),
  order_index: z.number().int().optional(),
  estimated_time_minutes: z.number().int().min(1).max(600).optional(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
});

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ lessonId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { lessonId } = await params;

  const { data, error } = await auth.supabase.from("learning_lessons").select("*").eq("id", lessonId).maybeSingle();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ lesson: data });
}

export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ lessonId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { lessonId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = lessonUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = {
    ...parsed.data,
    module_id: parsed.data.module_id ?? undefined,
    updated_by: auth.profile.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_lessons").update(patch).eq("id", lessonId).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ lesson: data });
}

