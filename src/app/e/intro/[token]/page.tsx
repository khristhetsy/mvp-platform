import { notFound } from "next/navigation";
import { introDetail, introFromToken } from "@/lib/icfo-events/introductions-server";
import { formatSlot, googleCalUrl, icsDataUrl } from "@/lib/icfo-events/calendar-links";
import { IntroRespondClient } from "./IntroRespondClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "An introduction at iCFO Events" };

/**
 * Answering an introduction from the email.
 *
 * No login. Most attendees at a large event registered as guests with no
 * account, and an introduction they cannot answer is worth nothing.
 *
 * The pair and the event are loaded here rather than left to the client: the
 * page used to know nothing but a signed id, so it could say "you have both
 * been named to each other" without ever saying to whom.
 */
export default async function IntroRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { token } = await params;
  const { a } = await searchParams;
  const id = introFromToken(token);
  if (!id) notFound();

  const detail = await introDetail(id);
  const event = detail?.event ?? null;
  const when = event?.startsAt ? formatSlot(event.startsAt, event.timezone) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <IntroRespondClient
        token={token}
        preset={a === "yes" ? "accept" : a === "no" ? "decline" : null}
        founder={detail?.founder ? { name: detail.founder.name, company: detail.founder.company } : null}
        event={
          event
            ? {
                title: event.title,
                when,
                googleUrl: event.startsAt
                  ? googleCalUrl({ title: event.title, startISO: event.startsAt, endISO: event.endsAt })
                  : null,
                icsUrl: event.startsAt
                  ? icsDataUrl({ title: event.title, startISO: event.startsAt, endISO: event.endsAt })
                  : null,
              }
            : null
        }
      />
    </main>
  );
}
