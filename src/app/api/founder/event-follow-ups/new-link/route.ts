import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { introDetail, recordLinkSent } from "@/lib/icfo-events/introductions-server";
import { bookLinkExpired } from "@/lib/icfo-events/introductions";
import { sendBookingFollowUpFor } from "@/lib/icfo-events/booking-follow-up";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ introId: z.string().uuid() });

/**
 * A founder sends a new Book a time link to an investor whose last link ran out.
 *
 * Not a follow up: it does not use one of the two, so it works after both are
 * spent. Only when the last link has really expired and no time is booked.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const auth = await requireApiProfile(["founder"]);
    if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const detail = await introDetail(parsed.data.introId);
    if (!detail || detail.founder?.profileId !== auth.profile.id) {
      return NextResponse.json({ error: "That introduction was not found." }, { status: 404 });
    }
    if (!bookLinkExpired(detail.intro)) {
      return NextResponse.json({ error: "The last link has not expired." }, { status: 400 });
    }

    const limit = checkRateLimit({ key: `founder-new-link:${detail.intro.id}`, limit: 1, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const sent = await sendBookingFollowUpFor(detail.intro.id);
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 });

    const now = new Date();
    await recordLinkSent(detail.intro.id, now);
    return NextResponse.json({ ok: true, lastFollowUpAt: now.toISOString() });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not send a new link." }, { status: 500 });
  }
}
