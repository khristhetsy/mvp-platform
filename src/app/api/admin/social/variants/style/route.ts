/**
 * Calendar event styling for a scheduled variant. Staff-only.
 *   PATCH { variantId, color?: string|null, busy?: boolean } → { ok }
 * color null → the UI falls back to the campaign color. busy drives calendar availability.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  variantId: z.string().uuid(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  busy: z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("color" in parsed.data) patch.event_color = parsed.data.color ?? null;
  if (parsed.data.busy !== undefined) patch.busy = parsed.data.busy;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { error } = await db.from("social_variants").update(patch).eq("id", parsed.data.variantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
