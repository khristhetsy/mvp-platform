import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  introDetail, runFollowUpPass, runFounderReminderPass,
  scheduleToken, type IntroRow,
} from "@/lib/icfo-events/introductions-server";
import { sendScheduleRequest } from "@/lib/icfo-events/introduction-emails";
import { sendBookingFollowUpFor } from "@/lib/icfo-events/booking-follow-up";
import { formatSlot } from "@/lib/icfo-events/calendar-links";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/**
 * The daily chase, in both directions.
 *
 * An investor who accepted and has no time booked is sent a link to book on
 * the founder's scheduling page, twice at most, before or after the event.
 * An investor who has not answered, or who declined, is never followed up. A founder who
 * has not given a time to an investor who already accepted is reminded, also
 * twice — the other half of the stall, and the more embarrassing one, because
 * somebody is expecting a meeting.
 *
 * Both report every skip, so a quiet day is explainable rather than
 * indistinguishable from a broken job.
 */
async function scheduledGET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const investors = await runFollowUpPass(async (intro: IntroRow) => {
      const sent = await sendBookingFollowUpFor(intro.id);
      if (sent.ok) return true;
      return sent.noAccount ? { skip: "founder has no account" } : false;
    });

    const founders = await runFounderReminderPass(async (intro: IntroRow) => {
      const detail = await introDetail(intro.id);
      if (!detail?.founder?.email) return false;
      return sendScheduleRequest({
        to: detail.founder.email,
        founderName: detail.founder.name,
        investorName: detail.investor?.name ?? "An investor",
        investorCompany: detail.investor?.company ?? null,
        eventTitle: detail.event?.title ?? "the event",
        when: detail.event?.startsAt ? formatSlot(detail.event.startsAt, detail.event.timezone) : null,
        scheduleUrl: `${BASE_URL.replace(/\/$/, "")}/e/intro/schedule/${scheduleToken(intro.id)}`,
      });
    });

    return NextResponse.json({ investors, founders });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "The follow-up pass failed." }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/intro-follow-ups", scheduledGET);
