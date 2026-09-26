import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  introDetail, listTemplates, runFollowUpPass, runFounderReminderPass,
  scheduleToken, type IntroRow,
} from "@/lib/icfo-events/introductions-server";
import { sendIntroductionEmail, sendScheduleRequest } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/**
 * The daily chase, in both directions.
 *
 * An investor who has not answered is followed up on the founder's behalf,
 * twice at most and never inside the last day before the event. A founder who
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
    const templates = await listTemplates();
    const followUp = templates.find((t) => t.kind === "follow_up");

    const investors = followUp
      ? await runFollowUpPass(async (intro: IntroRow) => {
          const detail = await introDetail(intro.id);
          if (!detail?.investor?.email) return false;
          return sendIntroductionEmail({
            introductionId: intro.id,
            to: detail.investor.email,
            template: followUp,
            investor: { name: detail.investor.name, company: detail.investor.company },
            founder: {
              name: detail.founder?.name ?? "a founder",
              company: detail.founder?.company ?? null,
              pitch: detail.founder?.pitch ?? null,
              stage: detail.founder?.stage ?? null,
              raising: detail.founder?.raising ?? null,
              roundSize: detail.founder?.roundSize ?? null,
              // The follow-up quotes the same reason as the invitation did.
              role: "founder",
            },
            eventTitle: detail.event?.title ?? "an iCFO event",
            eventWhen: detail.event?.startsAt
              ? formatSlot(detail.event.startsAt, detail.event.timezone)
              : null,
            sharedSectors: intro.sharedSectors,
            baseUrl: BASE_URL,
          });
        })
      : { considered: 0, sent: 0, skipped: { "no follow-up template": 1 } };

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
