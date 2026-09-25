import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFunnelEvent, FIT_CHOICE_EVENTS } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";

// fit_signup is written server-side by /api/lead, never from the browser.
const schema = z.object({ eventName: z.enum(FIT_CHOICE_EVENTS).exclude(["fit_signup"]) });

// Logs which path a visitor picks on the /fit options screen, keyed to the funnel
// session cookie. No cookie, no event. Never fails the caller.
export async function POST(req: NextRequest): Promise<Response> {
  const id = req.cookies.get("fs_session")?.value;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!id || !parsed.success) return NextResponse.json({ ok: false });
  await recordFunnelEvent({ sessionId: id, eventName: parsed.data.eventName });
  return NextResponse.json({ ok: true });
}
