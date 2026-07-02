import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listPages, createPage } from "@/lib/aeo/store";

export const dynamic = "force-dynamic";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens.").max(80);

const createSchema = z.object({
  slug,
  h1: z.string().min(1).max(200),
  eyebrow: z.string().max(120).optional(),
  lede: z.string().max(400).optional(),
  definition_answer: z.string().max(4000).optional(),
  defined_term: z.string().max(120).nullable().optional(),
  meta_description: z.string().max(320).optional(),
});

export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const pages = await listPages();
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const page = await createPage(parsed.data);
    return NextResponse.json({ page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    const status = /duplicate|unique/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "That slug is already taken." : message }, { status });
  }
}
