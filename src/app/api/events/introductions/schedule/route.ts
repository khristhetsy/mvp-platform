import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  founderTakenSlots, introDetail, introFromScheduleToken, rescheduleToken, scheduleIntroduction,
} from "@/lib/icfo-events/introductions-server";
import { checkMeetingUrl, checkSlot, SLOT_MINUTES } from "@/lib/icfo-events/intro-scheduling";
import { sendScheduledNotice } from "@/lib/icfo-events/introduction-emails";
import { formatSlot, googleCalUrl } from "@/lib/icfo-events/calendar-links";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

const schema = z.object({
  token: z.string().min(10),
  /** ISO start of a slot the picker offered. */
  startsAt: z.string().min(10),
  meetingUrl: z.string().min(1).max(500),
});

/**
 * The founder sets the time and the link.
 *
 * Signed link, no login: the founder is as likely to be a guest as the
 * investor. The slot is re-checked here against the event window and against
 * the founder's other introductions, because the picker was rendered before
 * whatever just happened to those slots.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromScheduleToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is no longer valid." }, { status: 403 });

    const detail = await introDetail(id);
    if (!detail) return NextResponse.json({ error: "That introduction no longer exists." }, { status: 404 });
    if (detail.intro.status !== "accepted") {
      return NextResponse.json({ error: "That introduction has not been accepted yet." }, { status: 400 });
    }

    const link = checkMeetingUrl(parsed.data.meetingUrl);
    if (!link.ok) return NextResponse.json({ error: link.reason }, { status: 400 });

    const taken = await founderTakenSlots(detail.intro.founderRegId, id);
    const slot = checkSlot({
      chosen: parsed.data.startsAt,
      startsAt: detail.event?.startsAt ?? null,
      endsAt: detail.event?.endsAt ?? null,
      taken,
    });
    if (!slot.ok) return NextResponse.json({ error: slot.reason }, { status: 409 });

    const endsAt = new Date(new Date(parsed.data.startsAt).getTime() + SLOT_MINUTES * 60_000).toISOString();
    const saved = await scheduleIntroduction(id, {
      startsAt: parsed.data.startsAt,
      endsAt,
      meetingUrl: link.url,
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });

    // Telling the investor is the point of the exercise, but a failed send
    // does not unbook the meeting — the page says whether it went.
    const when = formatSlot(parsed.data.startsAt, detail.event?.timezone ?? null);
    let notified = false;
    if (detail.investor?.email) {
      notified = await sendScheduledNotice({
        to: detail.investor.email,
        investorName: detail.investor.name,
        founderName: detail.founder?.name ?? "The founder",
        founderCompany: detail.founder?.company ?? null,
        eventTitle: detail.event?.title ?? "the event",
        when,
        meetingUrl: link.url,
        calendarUrl: googleCalUrl({
          title: `${detail.founder?.name ?? "Introduction"} · ${detail.event?.title ?? "iCFO Events"}`,
          startISO: parsed.data.startsAt,
          endISO: endsAt,
          details: link.url,
        }),
        // The investor's own link: asking is not choosing, so this must never
        // be the founder's picker.
        rescheduleUrl: `${BASE_URL.replace(/\/$/, "")}/e/intro/reschedule/${rescheduleToken(id)}`,
        changed: !saved.changed ? false : Boolean(detail.intro.scheduledAt),
      }).catch(() => false);
    }

    return NextResponse.json({ ok: true, when, notified });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't set the time." }, { status: 500 });
  }
}
