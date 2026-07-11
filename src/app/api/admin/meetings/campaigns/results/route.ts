import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listCampaignResults, createCampaignResult, romiSummary } from "@/lib/meetings/campaigns";

export const dynamic = "force-dynamic";

const schema = z.object({
  strategy: z.string().min(2).max(200), run_date: z.string().min(4), agent_id: z.string().uuid().nullable().optional(),
  impressions: z.number().int().min(0).optional(), members_reached: z.number().int().min(0).optional(),
  positive_replies: z.number().int().min(0).optional(), meetings: z.number().int().min(0).optional(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const [results, romi] = await Promise.all([listCampaignResults(), romiSummary()]);
  return NextResponse.json({ results, romi });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid result." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, id: await createCampaignResult(parsed.data, profile.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
