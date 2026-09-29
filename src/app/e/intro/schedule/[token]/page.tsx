import { notFound } from "next/navigation";
import {
  founderTakenSlots, introDetail, introFromScheduleToken,
} from "@/lib/icfo-events/introductions-server";
import { slotsFor } from "@/lib/icfo-events/intro-scheduling";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { IntroScheduleClient } from "./IntroScheduleClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pick a time · iCFO Events" };

/**
 * The founder picks a slot and brings a link.
 *
 * Signed link, no login — a founder who registered as a guest has no account
 * to sign into, and an investor who already accepted is waiting on them.
 */
export default async function IntroSchedulePage({ params }: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const id = introFromScheduleToken(token);
  if (!id) notFound();

  const detail = await introDetail(id);
  if (!detail) notFound();

  const taken = await founderTakenSlots(detail.intro.founderRegId, id);
  const slots = slotsFor({
    startsAt: detail.event?.startsAt ?? null,
    endsAt: detail.event?.endsAt ?? null,
    taken,
  }).map((s) => ({ ...s, label: formatSlot(s.startsAt, detail.event?.timezone ?? null) }));

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <IntroScheduleClient
        token={token}
        status={detail.intro.status}
        investor={detail.investor ? { name: detail.investor.name, company: detail.investor.company } : null}
        eventTitle={detail.event?.title ?? "the event"}
        eventWhen={detail.event?.startsAt ? formatSlot(detail.event.startsAt, detail.event.timezone) : null}
        slots={slots}
        askedForAnother={
          detail.intro.rescheduleRequestedAt
            ? { note: detail.intro.rescheduleNote, who: detail.investor?.name ?? "The investor" }
            : null
        }
        existing={
          detail.intro.scheduledAt
            ? {
                startsAt: detail.intro.scheduledAt,
                label: formatSlot(detail.intro.scheduledAt, detail.event?.timezone ?? null),
                meetingUrl: detail.intro.meetingUrl ?? "",
              }
            : null
        }
      />
    </main>
  );
}
