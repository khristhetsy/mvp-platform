import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const moduleCreateSchema = z.object({
  slug: z.string().min(3).max(160),
  title: z.string().min(3).max(200),
  category: z.string().min(1).max(120),
  description: z.string().min(10).max(5000),
  estimated_time_minutes: z.number().int().min(1).max(600).optional(),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional(),
  readiness_stage: z.string().min(1).max(80),
  order_index: z.number().int().optional(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).default("draft"),
  is_published: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const { data, error } = await auth.supabase
    .from("learning_modules")
    .select("id, slug, title, category, readiness_stage, difficulty, content_status, is_published, order_index, created_at")
    .order("order_index", { ascending: true })
    .limit(500);

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ modules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = moduleCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = {
    ...parsed.data,
    estimated_time_minutes: parsed.data.estimated_time_minutes ?? 15,
    difficulty: parsed.data.difficulty ?? "intermediate",
    is_published: parsed.data.is_published ?? parsed.data.content_status === "published",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_modules").insert(payload).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ module: data });
}

