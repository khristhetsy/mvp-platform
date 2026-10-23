import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFunnelEvent, FIT_CHOICE_EVENTS } from "@/lib/analytics/funnel";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";

export const dynamic = "force-dynamic";

// fit_signup is written server-side by /api/lead, and fit_variant by /api/fit/session,
// never from the browser.
const schema = z.object({ eventName: z.enum(FIT_CHOICE_EVENTS).exclude(["fit_signup", "fit_variant"]) });

// Logs which path a visitor picks on the /fit options screen, keyed to the funnel
// session cookie. No cookie, no event. Never fails the caller.
export async function POST(req: NextRequest): Promise<Response> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "fit-event", ip, limit: 300 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  const id = req.cookies.get("fs_session")?.value;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!id || !parsed.success) return NextResponse.json({ ok: false });
  await recordFunnelEvent({ sessionId: id, eventName: parsed.data.eventName });
  return NextResponse.json({ ok: true });
}
