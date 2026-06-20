import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAvailability } from "@/lib/scheduling/store";
import { BookingClient } from "@/components/calendar/BookingClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ hostId: string }> };

export default async function BookingPage({ params }: Props) {
  const { hostId } = await params;

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
        viewerName={viewer?.full_name ?? null}
        viewerEmail={viewer?.email ?? null}
      />
    </div>
  );
}
