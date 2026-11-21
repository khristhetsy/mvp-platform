import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  introDetail, introFromExpiredBookToken, recordLinkSent,
} from "@/lib/icfo-events/introductions-server";
import { sendBookingFollowUpFor } from "@/lib/icfo-events/booking-follow-up";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10) });

/**
 * A Book a time link ran out: email the investor a fresh one.
 *
 * The signature on the old link says who it was cut for, and the new link goes
 * only to the investor's address on file, never to anything sent in the
 * request. It does not count as one of the founder's follow ups. One request an
 * hour per introduction, so the button cannot fill an inbox.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromExpiredBookToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is not valid." }, { status: 403 });

    const limit = checkRateLimit({ key: `intro-book-link:${id}`, limit: 1, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const detail = await introDetail(id);
    if (!detail) return NextResponse.json({ error: "That introduction no longer exists." }, { status: 404 });
    if (detail.intro.status !== "accepted") {
      return NextResponse.json({ error: "That introduction has not been accepted." }, { status: 400 });
    }
    if (detail.intro.scheduledAt) {
      return NextResponse.json({ error: "A time is already booked." }, { status: 400 });
    }

    const sent = await sendBookingFollowUpFor(id);
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 });

    await recordLinkSent(id, new Date(), true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not send a new link." }, { status: 500 });
  }
}
