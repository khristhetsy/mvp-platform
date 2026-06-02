import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const quizCreateSchema = z.object({
  scope_type: z.enum(["course", "module", "lesson"]).default("lesson"),
  program_id: z.string().uuid().optional().nullable(),
  module_id: z.string().uuid().optional().nullable(),
  lesson_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(200),
  passing_score: z.number().int().min(0).max(100).default(70),
  retry_limit: z.number().int().min(0).max(50).optional().nullable(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).default("draft"),
});

export async function GET(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const url = new URL(request.url);
  const programId = url.searchParams.get("programId");
  const moduleId = url.searchParams.get("moduleId");
  const lessonId = url.searchParams.get("lessonId");

  let query = auth.supabase
    .from("learning_quizzes")
    .select("id, scope_type, program_id, module_id, lesson_id, title, passing_score, retry_limit, content_status, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (programId) query = query.eq("program_id", programId);
  if (moduleId) query = query.eq("module_id", moduleId);
  if (lessonId) query = query.eq("lesson_id", lessonId);

  const { data, error } = await query;
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ quizzes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = quizCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = {
    ...parsed.data,
    program_id: parsed.data.program_id ?? null,
    module_id: parsed.data.module_id ?? null,
    lesson_id: parsed.data.lesson_id ?? null,
    retry_limit: parsed.data.retry_limit ?? null,
    created_by: auth.profile.id,
    updated_by: auth.profile.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_quizzes").insert(payload).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ quiz: data });
}

