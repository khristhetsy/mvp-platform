import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAvailability } from "@/lib/scheduling/store";
import { BookingClient } from "@/components/calendar/BookingClient";
import { sourceTagFromQuery } from "@/lib/attribution/source";

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

  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", hostId).single();
  const host = data as { full_name: string | null; email: string | null } | null;
  if (!host) {
    redirect("/");
  }
  const hostName = host.full_name ?? host.email ?? "this member";
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
        viewerName={viewer?.full_name ?? null}
        viewerEmail={viewer?.email ?? null}
        sourceTag={sourceTag}
      />
    </div>
  );
}
