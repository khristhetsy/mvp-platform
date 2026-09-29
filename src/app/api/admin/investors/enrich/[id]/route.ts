/**
 * Approve / reject one enrichment proposal. Staff-only.
 *   PATCH { action: "approve", industries?, type?, stages? } | { action: "reject" } → { ok }
 * Approve writes the (optionally edited) values into the contact's overrides as inferred.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { applyProposal, rejectProposal } from "@/lib/fit/enrich-investors";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  industries: z.array(z.string().max(80)).max(20).optional(),
  type: z.string().max(60).nullable().optional(),
  // Clamped to the stage vocabulary in applyProposal, so accept plain strings here.
  stages: z.array(z.string().max(60)).max(7).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const ok = parsed.data.action === "approve"
    ? await applyProposal(id, { industries: parsed.data.industries, type: parsed.data.type, stages: parsed.data.stages }, profile.id)
    : await rejectProposal(id, profile.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
