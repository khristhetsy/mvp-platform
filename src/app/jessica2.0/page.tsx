import type { Metadata } from "next";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JESSICA_HOST_PROFILE_ID } from "@/lib/jessica/config";
import { Jessica2Chat } from "./Jessica2Chat";

export const metadata: Metadata = {
  title: "Talk to Jessica",
  description: "Ask Jessica about iCFO Capital Global, see the investors who fit your raise, and book a call with Khris.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Jessica 2.0. Public page: no sign in, no pricing. Same frame as /jessica; a
// tagged link (/jessica2.0?src=linkedin-oct) is carried onto the booking.
export default async function Jessica2Page({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const sourceTag = sourceTagFromQuery(query);

  return (
    <main className="flex min-h-screen justify-center bg-white px-4 py-6">
      <Jessica2Chat hostId={JESSICA_HOST_PROFILE_ID} sourceTag={sourceTag} />
    </main>
  );
}
