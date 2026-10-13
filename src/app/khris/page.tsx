import type { Metadata } from "next";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JESSICA_HOST_PROFILE_ID } from "@/lib/jessica/config";
import { KhrisChat } from "./KhrisChat";

export const metadata: Metadata = {
  title: "Talk to Khris Thetsy",
  description: "Talk with Khris Thetsy of iCFO Capital Global, see the investors who fit your raise, and book a call.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Public page: no sign in, no pricing. Same white frame as /jessica2.0; calls
// book on Khris's own calendar (the Jessica host). A tagged link
// (/khris?src=linkedin-oct) is carried onto the booking.
export default async function KhrisPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const sourceTag = sourceTagFromQuery(query);

  return (
    <main className="flex min-h-screen justify-center bg-white px-4 py-6">
      <KhrisChat hostId={JESSICA_HOST_PROFILE_ID} sourceTag={sourceTag} />
    </main>
  );
}
