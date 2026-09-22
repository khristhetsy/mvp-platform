import { notFound } from "next/navigation";
import { introDetail, introFromRescheduleToken } from "@/lib/icfo-events/introductions-server";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { IntroRescheduleClient } from "./IntroRescheduleClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask for another time · iCFO Events" };

/**
 * The investor asks for a different slot.
 *
 * A page rather than a one-click link, because the useful part is the note:
 * "could we do after 2?" saves a round trip over email we never see.
 */
export default async function IntroReschedulePage({ params }: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const id = introFromRescheduleToken(token);
  if (!id) notFound();

  const detail = await introDetail(id);
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <IntroRescheduleClient
        token={token}
        status={detail.intro.status}
        founderName={detail.founder?.name ?? "the founder"}
        eventTitle={detail.event?.title ?? "the event"}
        currentWhen={
          detail.intro.scheduledAt
            ? formatSlot(detail.intro.scheduledAt, detail.event?.timezone ?? null)
            : null
        }
        alreadyAsked={Boolean(detail.intro.rescheduleRequestedAt)}
      />
    </main>
  );
}
