import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsCampaign } from "@/lib/social/founder-auth";
import { campaignFunnels, aggregateFunnels, type Grain } from "@/lib/social/funnel";
import { setCampaignGoals } from "@/lib/social/goals-io";

export const dynamic = "force-dynamic";

const GRAINS = ["week", "month", "quarter", "year"] as const;

// Goals per funnel stage for the founder's own campaigns. Read: ?grain=week|month|quarter|year.
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const g = new URL(req.url).searchParams.get("grain") ?? "month";
  const grain: Grain = (GRAINS as readonly string[]).includes(g) ? (g as Grain) : "month";
  const funnels = await campaignFunnels(grain, new Date(), auth.founderId).catch(() => []);
  return NextResponse.json({ grain, funnels, aggregate: aggregateFunnels(funnels) });
}

const postSchema = z.object({
  campaignId: z.string().uuid(),
  grain: z.enum(GRAINS),
  goals: z.object({
    outreach: z.number().int().min(0).max(1_000_000).nullable().optional(),
    clicks: z.number().int().min(0).max(1_000_000).nullable().optional(),
    meetings: z.number().int().min(0).max(1_000_000).nullable().optional(),
    conversions: z.number().int().min(0).max(1_000_000).nullable().optional(),
  }),
});

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid goals." }, { status: 400 });
  if (!(await ownsCampaign(auth.founderId, parsed.data.campaignId))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const goals = await setCampaignGoals(parsed.data.campaignId, parsed.data.grain, parsed.data.goals, new Date(), auth.founderId);
  if (!goals) return NextResponse.json({ error: "Could not save goals." }, { status: 400 });
  return NextResponse.json({ goals });
}
