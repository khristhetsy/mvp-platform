import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFunnelEvent, FUNNEL_EVENTS, type FunnelEventName } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";

// Public beacon for client-side funnel steps only. Server-side steps (checkout,
// distribution, intros, renewal) are emitted directly from their server routes.
const CLIENT_EVENTS = new Set<FunnelEventName>(["post_click", "landing_view", "assessment_start", "pricing_view"]);

const schema = z.object({
  sessionId: z.string().min(1).max(120),
  eventName: z.enum(FUNNEL_EVENTS),
  properties: z.record(z.string(), z.unknown()).nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !CLIENT_EVENTS.has(parsed.data.eventName)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await recordFunnelEvent({
    sessionId: parsed.data.sessionId,
    eventName: parsed.data.eventName,
    properties: parsed.data.properties ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
