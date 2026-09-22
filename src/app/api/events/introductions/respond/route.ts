import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  introDetail, introFromToken, respondToIntroduction, scheduleToken,
} from "@/lib/icfo-events/introductions-server";
import { sendScheduleRequest } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

const schema = z.object({ token: z.string().min(10), accept: z.boolean() });

/**
 * Accept or decline an introduction from the signed link in the email.
 *
 * No login: most attendees at a large event registered as guests, and an
 * introduction they cannot answer is worthless. The token carries the id and
 * is signed, so possession of the link is the authorisation.
 *
 * Accepting no longer mints a video room. The founder brings the link and
 * picks the slot — a room minted here would be dead long before an event
 * three weeks out, and the founder is the one doing the chasing.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is no longer valid." }, { status: 403 });

    const result = await respondToIntroduction(id, parsed.data.accept);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    if (!parsed.data.accept) return NextResponse.json({ accepted: false });

    const detail = await introDetail(id);
    const when = detail?.event?.startsAt
      ? formatSlot(detail.event.startsAt, detail.event.timezone)
      : null;

    // Asking the founder is the whole point of accepting, but a failed send
    // does not undo the acceptance — the reminder pass will try again.
    let founderNotified = false;
    if (detail?.founder?.email && !result.alreadyAnswered) {
      founderNotified = await sendScheduleRequest({
        to: detail.founder.email,
        founderName: detail.founder.name,
        investorName: detail.investor?.name ?? "An investor",
        investorCompany: detail.investor?.company ?? null,
        eventTitle: detail.event?.title ?? "the event",
        when,
        scheduleUrl: `${BASE_URL.replace(/\/$/, "")}/e/intro/schedule/${scheduleToken(id)}`,
      }).catch(() => false);
    }

    return NextResponse.json({
      accepted: true,
      alreadyAnswered: result.alreadyAnswered,
      founderNotified,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
