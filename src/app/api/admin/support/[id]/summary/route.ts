import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSupportSettings } from "@/lib/support/settings";
import { draftResolutionSummary } from "@/lib/support/ai";

export const dynamic = "force-dynamic";

// The "here's what we fixed" summary for the resolve email. Staff edit it before it goes out.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await ctx.params;
  if (!(await getSupportSettings()).ai.drafts) return NextResponse.json({ summary: "", unavailable: true });
  try {
    const r = await draftResolutionSummary(id, profile.id);
    return "unavailable" in r ? NextResponse.json({ summary: "", unavailable: true }) : NextResponse.json({ summary: r.summary });
  } catch {
    return NextResponse.json({ summary: "", unavailable: true });
  }
}
