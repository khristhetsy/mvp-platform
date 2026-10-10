import type { Metadata } from "next";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JESSICA_HOST_PROFILE_ID } from "@/lib/jessica/config";
import { JessicaChat } from "./JessicaChat";

export const metadata: Metadata = {
  title: "Talk to Jessica",
  description: "Ask Jessica about iCFO Capital Global and book a call with the team.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Public page: no sign in, no pricing. A tagged link (/jessica?src=linkedin-oct)
// is carried onto the booking the same way the scheduler pages do it.
export default async function JessicaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const sourceTag = sourceTagFromQuery(query);

  return (
    <main className="flex min-h-screen justify-center bg-white px-4 py-6">
      <JessicaChat hostId={JESSICA_HOST_PROFILE_ID} sourceTag={sourceTag} />
    </main>
  );
}
