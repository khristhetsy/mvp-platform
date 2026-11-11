import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { DEFAULT_BRIEF_TEMPLATE } from "@/lib/support/assistant-prompt";
import { MAX_BRIEF_CHARS, saveBriefTemplate } from "@/lib/support/assistant-training";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().max(MAX_BRIEF_CHARS) });

/**
 * Save the support assistant's product knowledge. Empty text returns to the
 * built in default. Prices are never typed here: the token {{PLANS}} is filled
 * from Admin Pricing at answer time.
 */
export async function PUT(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Keep the text under ${MAX_BRIEF_CHARS} characters.` }, { status: 400 });
  const text = parsed.data.text.trim() === DEFAULT_BRIEF_TEMPLATE.trim() ? "" : parsed.data.text;
  const ok = await saveBriefTemplate(text, profile.id);
  if (!ok) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true, usingDefault: !text.trim() });
}
