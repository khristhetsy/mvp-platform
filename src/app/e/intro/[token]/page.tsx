import { notFound } from "next/navigation";
import { introFromToken } from "@/lib/icfo-events/introductions-server";
import { IntroRespondClient } from "./IntroRespondClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "An introduction at iCFO Events" };

/**
 * Answering an introduction from the email.
 *
 * No login. Most attendees at a large event registered as guests with no
 * account, and an introduction they cannot answer is worth nothing.
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
  if (!introFromToken(token)) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <IntroRespondClient token={token} preset={a === "yes" ? "accept" : a === "no" ? "decline" : null} />
    </main>
  );
}
