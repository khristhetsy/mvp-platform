/**
 * Funnel goals + report. Staff-only.
 *   GET  ?grain=week|month|quarter|year → { grain, periodStart, funnels, aggregate }
 *   POST { campaignId, grain, goals:{outreach?,clicks?,meetings?,conversions?} } → { goals }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { campaignFunnels, aggregateFunnels, type Grain } from "@/lib/social/funnel";
import { setCampaignGoals } from "@/lib/social/goals-io";

export const dynamic = "force-dynamic";

const GRAINS = ["week", "month", "quarter", "year"] as const;
function grainOf(v: string | null): Grain { return (GRAINS as readonly string[]).includes(v ?? "") ? (v as Grain) : "month"; }

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const grain = grainOf(new URL(req.url).searchParams.get("grain"));
  const funnels = await campaignFunnels(grain);
  return NextResponse.json({ grain, periodStart: funnels[0]?.periodStart ?? null, funnels, aggregate: aggregateFunnels(funnels) });
}

const postSchema = z.object({
  campaignId: z.string().uuid(),
  grain: z.enum(GRAINS),
  goals: z.object({
    outreach: z.number().int().min(0).nullable().optional(),
    clicks: z.number().int().min(0).nullable().optional(),
    meetings: z.number().int().min(0).nullable().optional(),
    conversions: z.number().int().min(0).nullable().optional(),
  }),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid goals." }, { status: 400 });
  const goals = await setCampaignGoals(parsed.data.campaignId, parsed.data.grain, parsed.data.goals, new Date(), profile.id);
  if (!goals) return NextResponse.json({ error: "Could not save goals." }, { status: 400 });
  return NextResponse.json({ goals });
}
