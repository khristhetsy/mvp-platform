import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  introDetail, introFromRescheduleToken, requestReschedule, scheduleToken, MAX_RESCHEDULE_NOTE,
} from "@/lib/icfo-events/introductions-server";
import { sendRescheduleRequest } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

const schema = z.object({
  token: z.string().min(10),
  note: z.string().max(MAX_RESCHEDULE_NOTE).optional(),
});

/**
 * The investor asks for a different time.
 *
 * Its own token action: the investor may ask, but the founder chooses, so this
 * link can never be replayed into the founder's picker.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromRescheduleToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is no longer valid." }, { status: 403 });

    const result = await requestReschedule(id, parsed.data.note ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const detail = await introDetail(id);
    let notified = false;
    if (detail?.founder?.email) {
      notified = await sendRescheduleRequest({
        to: detail.founder.email,
        founderName: detail.founder.name,
        investorName: detail.investor?.name ?? "The investor",
        eventTitle: detail.event?.title ?? "the event",
        currentWhen: detail.intro.scheduledAt
          ? formatSlot(detail.intro.scheduledAt, detail.event?.timezone ?? null)
          : null,
        note: parsed.data.note?.trim() || null,
        scheduleUrl: `${BASE_URL.replace(/\/$/, "")}/e/intro/schedule/${scheduleToken(id)}`,
      }).catch(() => false);
    }

    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't send that." }, { status: 500 });
  }
}
