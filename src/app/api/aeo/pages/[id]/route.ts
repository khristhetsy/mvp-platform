import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getPage, updatePage } from "@/lib/aeo/store";

export const dynamic = "force-dynamic";

const sectionSchema = z.object({
  id: z.string().max(80),
  heading: z.string().max(200),
  body: z.string().max(4000),
});
const faqSchema = z.object({ q: z.string().max(300), a: z.string().max(2000) });

const patchSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  eyebrow: z.string().max(120).optional(),
  h1: z.string().min(1).max(200).optional(),
  lede: z.string().max(400).optional(),
  definition_answer: z.string().max(4000).optional(),
  defined_term: z.string().max(120).nullable().optional(),
  sections: z.array(sectionSchema).max(20).optional(),
  faq: z.array(faqSchema).max(30).optional(),
  meta_description: z.string().max(320).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const page = await getPage(id);
    if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ page });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const page = await updatePage(id, parsed.data);
    return NextResponse.json({ page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed.";
    const status = /duplicate|unique/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "That slug is already taken." : message }, { status });
  }
}
