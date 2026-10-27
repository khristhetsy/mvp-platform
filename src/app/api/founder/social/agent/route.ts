import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderSocial } from "@/lib/social/founder-auth";
import { NETWORKS, NETWORK_LIMITS, TEMPLATE_KEYS, addHashtags, draftFromTemplate, nextPostTip, shorten, variantsPerNetwork, type Network } from "@/lib/social/templates";
import { campaignFunnels, aggregateFunnels } from "@/lib/social/funnel";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

// The founder AI agent, free mode only. It imports templates.ts and the funnel reader, never the
// paid Anthropic client, and never counts toward the post limit. It drafts; the founder confirms.
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("template"), template: z.enum(TEMPLATE_KEYS), notes: z.string().max(4000), company: z.string().max(120).nullish() }),
  z.object({ action: z.literal("shorten"), text: z.string().max(8000), network: z.enum(NETWORKS).default("linkedin") }),
  z.object({ action: z.literal("hashtags"), text: z.string().max(8000) }),
  z.object({ action: z.literal("variants"), text: z.string().max(8000), networks: z.array(z.enum(NETWORKS)).min(1).max(4) }),
  z.object({ action: z.literal("next") }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireFounderSocial();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;
  switch (d.action) {
    case "template":
      return NextResponse.json({ text: draftFromTemplate(d.template, { notes: d.notes, company: d.company }) });
    case "shorten":
      return NextResponse.json({ text: shorten(d.text, NETWORK_LIMITS[d.network as Network]) });
    case "hashtags":
      return NextResponse.json({ text: addHashtags(d.text) });
    case "variants":
      return NextResponse.json({ variants: variantsPerNetwork(d.text, d.networks as Network[]) });
    case "next": {
      const funnels = await campaignFunnels("month", new Date(), auth.founderId).catch(() => []);
      const stages = aggregateFunnels(funnels);
      // Weakest step: the lowest share of goal among stages that have a goal.
      const withGoal = stages.filter((s) => s.target && s.target > 0);
      const weakest = withGoal.sort((a, b) => (a.pctOfGoal ?? 0) - (b.pctOfGoal ?? 0))[0];
      const map = { outreach: "outreach", clicks: "clicks", meetings: "meetings", conversions: "intros" } as const;
      return NextResponse.json({ tip: nextPostTip({ weakestStage: weakest ? map[weakest.stage] : null }) });
    }
  }
}
