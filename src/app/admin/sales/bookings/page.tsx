import { requireRole } from "@/lib/supabase/auth";
import { AppShell } from "@/components/AppShell";
import { SalesHubHeader } from "../SalesHubHeader";
import { listBookings } from "@/lib/scheduling/bookings";
import { BookingsClient } from "./BookingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const bookings = await listBookings({ limit: 200 }).catch(() => []);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <BookingsClient bookings={bookings} />
    </AppShell>
  );
}
