import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial, ownsCampaign } from "@/lib/social/founder-auth";
import { createCampaign, listCampaigns, setCampaignArchived, updateCampaign } from "@/lib/social/campaigns";
import { campaignFunnels, periodStart, nextPeriodStart } from "@/lib/social/funnel";
import { founderIntroBreakdown } from "@/lib/social/founder-intros";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const now = new Date();
  const start = periodStart("month", now);
  const [campaigns, funnels] = await Promise.all([
    listCampaigns(auth.founderId),
    campaignFunnels("month", now, auth.founderId).catch(() => []),
  ]);
  const breakdown = await founderIntroBreakdown(auth.founderId, start, nextPeriodStart("month", start), funnels.map((f) => f.sourceTag)).catch(() => ({ total: 0, fromLinks: 0, byTag: {} as Record<string, number> }));
  // intros is what the Overview counts: only investors who came through a tracked link.
  const intros = breakdown.fromLinks;
  const introsOther = Math.max(0, breakdown.total - breakdown.fromLinks);
  return NextResponse.json({ campaigns, funnels, intros, introsOther, introsByTag: breakdown.byTag });
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Name the campaign." }, { status: 400 });
  const campaign = await createCampaign(parsed.data.name, 0, auth.founderId, "camp", auth.founderId);
  if (!campaign) return NextResponse.json({ error: "Could not create campaign." }, { status: 400 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = z.object({ id: z.string().uuid(), name: z.string().min(1).max(80).optional(), archived: z.boolean().optional() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!(await ownsCampaign(auth.founderId, parsed.data.id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const ok = parsed.data.archived !== undefined
    ? await setCampaignArchived(parsed.data.id, parsed.data.archived)
    : await updateCampaign(parsed.data.id, { name: parsed.data.name });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not update campaign." }, { status: 400 });
}
