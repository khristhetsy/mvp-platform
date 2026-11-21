import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  introDetail, introFromExpiredScheduleToken, scheduleUrlFor,
} from "@/lib/icfo-events/introductions-server";
import { sendScheduleRequest } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10) });

/**
 * A set a time link ran out: email the founder a fresh one.
 *
 * The signature on the old link says who it was cut for, and the new link goes
 * only to the founder's address on file, never to anything sent in the request.
 * One request an hour per introduction, so the button cannot fill an inbox.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromExpiredScheduleToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is not valid." }, { status: 403 });

    const limit = checkRateLimit({ key: `intro-new-link:${id}`, limit: 1, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const detail = await introDetail(id);
    if (!detail) return NextResponse.json({ error: "That introduction no longer exists." }, { status: 404 });
    if (detail.intro.status !== "accepted") {
      return NextResponse.json({ error: "That introduction has not been accepted." }, { status: 400 });
    }
    if (!detail.founder?.email) {
      return NextResponse.json({ error: "There is no email on file to send a link to." }, { status: 400 });
    }

    const sent = await sendScheduleRequest({
      to: detail.founder.email,
      founderName: detail.founder.name,
      investorName: detail.investor?.name ?? "An investor",
      investorCompany: detail.investor?.company ?? null,
      eventTitle: detail.event?.title ?? "the event",
      when: detail.event?.startsAt ? formatSlot(detail.event.startsAt, detail.event.timezone) : null,
      scheduleUrl: scheduleUrlFor(id),
    });
    if (!sent) return NextResponse.json({ error: "The email could not be sent." }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not send a new link." }, { status: 500 });
  }
}
