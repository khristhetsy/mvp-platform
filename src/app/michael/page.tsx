import type { Metadata } from "next";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JESSICA_HOST_PROFILE_ID } from "@/lib/jessica/config";
import { MichaelChat } from "./MichaelChat";

export const metadata: Metadata = {
  title: "Talk to Michael Lerma",
  description: "Talk with Michael Lerma of iCFO Capital Newport Beach about your raise or your deals, and book a call with the team.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Public page: no sign in, no pricing. Same white frame as /jessica; calls book
// on the shared calendar host. A tagged link (/michael?src=linkedin-oct) is
// carried onto the booking.
export default async function MichaelPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const sourceTag = sourceTagFromQuery(query);

  return (
    <main className="flex min-h-screen justify-center bg-white px-4 py-6">
      <MichaelChat hostId={JESSICA_HOST_PROFILE_ID} sourceTag={sourceTag} />
    </main>
  );
}
