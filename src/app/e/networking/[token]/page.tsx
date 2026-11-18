import { notFound } from "next/navigation";
import { networkingChoiceFor, registrationFromNetworkingToken } from "@/lib/icfo-events/networking-choice";
import { NetworkingChoiceClient } from "./NetworkingChoiceClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Networking at iCFO Events" };

/**
 * Answering the networking question from the registration email.
 *
 * No login. The page never changes anything on load: an email scanner that
 * opens the link must not be able to remove someone from the list.
 */
export default async function NetworkingChoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { token } = await params;
  const { a } = await searchParams;
  const id = registrationFromNetworkingToken(token);
  if (!id) notFound();
  const current = await networkingChoiceFor(id);
  if (!current) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <NetworkingChoiceClient
        token={token}
        eventTitle={current.eventTitle}
        initialOptedIn={current.optedIn}
        preset={a === "no" ? "no" : a === "yes" ? "yes" : null}
      />
    </main>
  );
}
