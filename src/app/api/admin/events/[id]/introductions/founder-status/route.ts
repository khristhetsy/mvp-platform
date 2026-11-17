import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEventById } from "@/lib/icfo-events/queries";
import { contactsFor, listIntroductions, scheduleToken } from "@/lib/icfo-events/introductions-server";
import { sendFounderStatus } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { acceptedCount, summarizeByFounder } from "@/lib/icfo-events/founder-status";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

const schema = z.object({
  /** Look only: say who would be emailed, and send nothing. */
  dryRun: z.boolean().default(false),
});

/**
 * Email every founder where their introductions stand.
 *
 * A snapshot sent when staff press the button, never on a schedule. The
 * founder already hears the moment someone accepts; this adds the counts the
 * founder has no other way to see. Investors who declined are counted only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: eventId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const [event, intros] = await Promise.all([
      getEventById(auth.supabase, eventId).catch(() => null),
      listIntroductions(eventId),
    ]);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const byFounder = summarizeByFounder(intros);
    if (!byFounder.size) {
      return NextResponse.json({ error: "No introductions have been sent for this event yet." }, { status: 400 });
    }

    const contacts = await contactsFor([
      ...byFounder.keys(),
      ...intros.map((i) => i.investorRegId),
    ]);
    const who = (regId: string) => {
      const c = contacts.get(regId);
      return { name: c?.name ?? "An investor", company: c?.company ?? null };
    };

    const founders = [...byFounder.values()]
      .map((s) => ({ s, contact: contacts.get(s.founderRegId) }))
      .filter((x) => Boolean(x.contact?.email));
    const noEmail = byFounder.size - founders.length;

    if (parsed.data.dryRun) {
      return NextResponse.json({
        founders: founders.map(({ s, contact }) => ({
          name: contact?.name ?? "Founder",
          introduced: s.introduced,
          accepted: acceptedCount(s),
          awaiting: s.awaiting,
          declined: s.declined,
        })),
        noEmail,
      });
    }

    let emailed = 0;
    let failed = 0;
    for (const { s, contact } of founders) {
      try {
        const ok = await sendFounderStatus({
          to: String(contact?.email),
          founderName: contact?.name ?? "there",
          eventTitle: event.title,
          introduced: s.introduced,
          awaiting: s.awaiting,
          declined: s.declined,
          needsTime: s.needsTime.map((r) => ({
            ...who(r.investorRegId),
            scheduleUrl: `${BASE_URL.replace(/\/$/, "")}/e/intro/schedule/${scheduleToken(r.id)}`,
          })),
          scheduled: s.scheduled.map((r) => ({
            ...who(r.investorRegId),
            when: formatSlot(String(r.scheduledAt), event.timezone ?? null),
          })),
        });
        if (ok) emailed += 1; else failed += 1;
      } catch (e) {
        failed += 1;
        Sentry.captureException(e);
      }
    }

    return NextResponse.json({ emailed, failed, noEmail });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't email the founders." }, { status: 500 });
  }
}
