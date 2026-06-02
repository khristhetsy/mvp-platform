import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const linkSchema = z.object({
  module_id: z.string().uuid(),
  order_index: z.number().int().optional().default(0),
});

const reorderSchema = z.object({
  links: z.array(linkSchema).min(1),
});

export async function POST(request: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { courseId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("learning_program_modules")
    .upsert(
      { program_id: courseId, module_id: parsed.data.module_id, order_index: parsed.data.order_index ?? 0 },
      { onConflict: "program_id,module_id" },
    )
    .select("*")
    .single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ link: data });
}

export async function PUT(request: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { courseId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates = parsed.data.links.map((l) => ({
    program_id: courseId,
    module_id: l.module_id,
    order_index: l.order_index ?? 0,
  }));

  const { data, error } = await auth.supabase
    .from("learning_program_modules")
    .upsert(updates, { onConflict: "program_id,module_id" })
    .select("program_id, module_id, order_index");

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ links: data ?? [] });
}

export async function DELETE(request: Request, { params }: Readonly<{ params: Promise<{ courseId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { courseId } = await params;

  const url = new URL(request.url);
  const moduleId = url.searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "moduleId is required." }, { status: 400 });

  const { error } = await auth.supabase
    .from("learning_program_modules")
    .delete()
    .eq("program_id", courseId)
    .eq("module_id", moduleId);

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ ok: true });
}

