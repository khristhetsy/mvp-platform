import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { BookingClient } from "@/components/calendar/BookingClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ hostId: string }> };

export default async function BookingPage({ params }: Props) {
  const { hostId } = await params;

  const viewer = await getCurrentUserProfile();
  if (!viewer) {
    redirect(`/auth/sign-in?next=/schedule/${hostId}`);
  }

  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", hostId).single();
  const host = data as { full_name: string | null; email: string | null } | null;
  if (!host) {
    redirect("/");
  }
  const hostName = host.full_name ?? host.email ?? "this member";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BookingClient hostId={hostId} hostName={hostName} />
    </div>
  );
}
