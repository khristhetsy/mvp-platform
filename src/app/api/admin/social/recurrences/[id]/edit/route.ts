/**
 * Edit a recurring post by scope (Google-style). Staff-only.
 *   POST { scope: "this" | "following" | "all", variantId, body?, deltaMin? } → { ok, updated, skipped }
 * `body` replaces the copy for the clicked post's account; `deltaMin` moves the time of day.
 * For "following" and "all" the series template changes too, so future posts pick it up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { editSeriesPosts } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";

const schema = z.object({
  scope: z.enum(["this", "following", "all"]),
  variantId: z.string().uuid(),
  body: z.string().max(4000).nullable().optional(),
  deltaMin: z.number().int().min(-1439).max(1439).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.body !== undefined && parsed.data.body !== null && !parsed.data.body.trim()) {
    return NextResponse.json({ error: "Body can't be empty." }, { status: 400 });
  }
  const res = await editSeriesPosts(id, parsed.data.scope, { variantId: parsed.data.variantId, body: parsed.data.body ?? null, deltaMin: parsed.data.deltaMin ?? null, userId: profile.id });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
