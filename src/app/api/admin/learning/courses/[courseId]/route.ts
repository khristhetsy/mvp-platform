import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, ensureCanPublish, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const courseUpdateSchema = z.object({
  slug: z.string().min(3).max(120).optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  readiness_focus: z.string().min(1).max(120).optional(),
  category: z.string().max(120).optional().nullable(),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]).optional().nullable(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
  is_published: z.boolean().optional(),
  order_index: z.number().int().optional(),
  banner_image_url: z.string().url().optional().nullable(),
});

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { courseId } = await params;

  const [{ data: program, error: programError }, { data: links, error: linksError }] = await Promise.all([
    auth.supabase
      .from("learning_programs")
      .select("id, slug, title, description, readiness_focus, category, difficulty, content_status, is_published, order_index, banner_image_url, created_at")
      .eq("id", courseId)
      .maybeSingle(),
    auth.supabase
      .from("learning_program_modules")
      .select("module_id, order_index")
      .eq("program_id", courseId)
      .order("order_index", { ascending: true }),
  ]);

  if (programError) return jsonBadRequest(programError);
  if (linksError) return jsonBadRequest(linksError);

  return NextResponse.json({ program, moduleLinks: links ?? [] });
}

export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { courseId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = courseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const patch = { ...parsed.data, updated_at: new Date().toISOString() };
  const { data, error } = await auth.supabase.from("learning_programs").update(patch).eq("id", courseId).select("*").single();
  if (error) return jsonBadRequest(error);

  return NextResponse.json({ program: data });
}

export async function DELETE(_: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  try {
    ensureCanPublish(auth.profile);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Insufficient permissions." }, { status: 403 });
  }

  const { courseId } = await params;

  // Child rows (module links, progress, certificates) are removed or detached by FK rules.
  const { data, error } = await auth.supabase
    .from("learning_programs")
    .delete()
    .eq("id", courseId)
    .select("id");
  if (error) return jsonBadRequest(error);
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: courseId });
}
