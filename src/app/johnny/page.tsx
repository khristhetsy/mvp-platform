import type { Metadata } from "next";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JOHNNY_HOST_PROFILE_ID } from "@/lib/johnny/config";
import { JohnnyChat } from "./JohnnyChat";

export const metadata: Metadata = {
  title: "Talk to Johnny",
  description: "Talk to Johnny in Investor Relations at iCFO Capital Global and book a call with the team.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Public page: no sign in, no pricing. A tagged link (/johnny?src=linkedin-oct)
// is carried onto the booking the same way the scheduler pages do it.
export default async function JohnnyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const sourceTag = sourceTagFromQuery(query);

  return (
    <main className="flex min-h-screen justify-center bg-white px-4 py-6">
      <JohnnyChat hostId={JOHNNY_HOST_PROFILE_ID} sourceTag={sourceTag} />
    </main>
  );
}
