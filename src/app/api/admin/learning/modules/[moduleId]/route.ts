import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const moduleUpdateSchema = z.object({
  slug: z.string().min(3).max(160).optional(),
  title: z.string().min(3).max(200).optional(),
  category: z.string().min(1).max(120).optional(),
  description: z.string().min(10).max(5000).optional(),
  estimated_time_minutes: z.number().int().min(1).max(600).optional(),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional(),
  readiness_stage: z.string().min(1).max(80).optional(),
  order_index: z.number().int().optional(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
  is_published: z.boolean().optional(),
});

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ moduleId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { moduleId } = await params;

  const { data, error } = await auth.supabase
    .from("learning_modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ module: data });
}

export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ moduleId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { moduleId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = moduleUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = { ...parsed.data, updated_at: new Date().toISOString() };
  const { data, error } = await auth.supabase.from("learning_modules").update(patch).eq("id", moduleId).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ module: data });
}

