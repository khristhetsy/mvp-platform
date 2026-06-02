import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const courseCreateSchema = z.object({
  slug: z.string().min(3).max(120),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  readiness_focus: z.string().min(1).max(120),
  category: z.string().max(120).optional().nullable(),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional().nullable(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).default("draft"),
  is_published: z.boolean().optional(),
  order_index: z.number().int().optional(),
});

export async function GET() {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const { data, error } = await auth.supabase
    .from("learning_programs")
    .select("id, slug, title, readiness_focus, category, difficulty, content_status, is_published, order_index, created_at")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = courseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description,
    readiness_focus: parsed.data.readiness_focus,
    category: parsed.data.category ?? null,
    difficulty: parsed.data.difficulty ?? "intermediate",
    content_status: parsed.data.content_status,
    is_published: parsed.data.is_published ?? parsed.data.content_status === "published",
    order_index: parsed.data.order_index ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_programs").insert(payload).select("*").single();
  if (error) return jsonBadRequest(error);

  return NextResponse.json({ program: data });
}

