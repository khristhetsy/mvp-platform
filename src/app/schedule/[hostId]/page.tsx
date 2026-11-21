import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAvailability } from "@/lib/scheduling/store";
import { BookingClient } from "@/components/calendar/BookingClient";
import { sourceTagFromQuery } from "@/lib/attribution/source";
import { verifyFounderToken } from "@/lib/marketing/match-campaign/token";
import { founderBookingPrefill } from "@/lib/marketing/match-campaign/store";
import { introDetail, introFromBookToken, introFromExpiredBookToken } from "@/lib/icfo-events/introductions-server";
import { maskEmail } from "@/lib/icfo-events/mask-email";
import { ExpiredBookingLink } from "./ExpiredBookingLink";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ hostId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { hostId } = await params;

  // A tagged scheduler link — /schedule/<host>?src=linkedin-sept — is how a
  // meeting booked straight from a post gets attributed. Read here and handed
  // to the form so it travels with the booking; the middleware cookie is the
  // fallback for people who landed elsewhere first.
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v] as [string, string]] : [],
    ),
  );
  const sourceTag = sourceTagFromQuery(query);

  // Public page — anyone with the link can book (guest booking). If the visitor
  // happens to be signed in, we prefill their name/email.
  const viewer = await getCurrentUserProfile();

  // A Match campaign link (/mc/<token>?a=call) adds the founder token: prefill
  // the founder's name, email and company, and mark them booked on confirm.
  const mcRaw = typeof sp.mc === "string" ? sp.mc : null;
  const founderId = verifyFounderToken(mcRaw);
  const founder = founderId ? await founderBookingPrefill(founderId).catch(() => null) : null;
  const matchToken = founder ? mcRaw : null;

  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", hostId).single();
  const host = data as { full_name: string | null; email: string | null } | null;
  if (!host) {
    redirect("/");
  }
  const hostName = host.full_name ?? host.email ?? "this member";

  // The Book a time link in a follow up email carries a 30 day token (?fu=). A
  // link past its 30 days offers a fresh one. The plain page, with no token or
  // with one that is not ours, stays open to anyone.
  const fu = typeof sp.fu === "string" ? sp.fu : null;
  if (fu && !introFromBookToken(fu)) {
    const expiredId = introFromExpiredBookToken(fu);
    const lapsed = expiredId ? await introDetail(expiredId) : null;
    if (lapsed && lapsed.founder?.profileId === hostId && !lapsed.intro.scheduledAt) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16">
          <ExpiredBookingLink
            token={fu}
            founderName={hostName}
            maskedEmail={lapsed.investor?.email ? maskEmail(lapsed.investor.email) : null}
          />
        </div>
      );
    }
  }
  const availability = await loadAvailability(admin, hostId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BookingClient
        hostId={hostId}
        hostName={hostName}
        meetingTitle={availability.meetingTitle}
        slotDurations={availability.slotDurations}
        questions={availability.questions}
        contactFields={availability.contactFields}
        viewerName={viewer?.full_name ?? founder?.name ?? null}
        viewerEmail={viewer?.email ?? founder?.email ?? null}
        viewerCompany={founder?.company ?? null}
        sourceTag={sourceTag}
        matchToken={matchToken}
        afterBooking={matchToken ? { href: `/matches/${matchToken}`, label: "View your matches", note: "Before the call, look through your matches so we can focus on the ones you like." } : null}
      />
    </div>
  );
}
