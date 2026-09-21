import { requireRole } from "@/lib/supabase/auth";
import { AppShell } from "@/components/AppShell";
import { SalesHubHeader } from "../SalesHubHeader";
import { listBookings } from "@/lib/scheduling/bookings";
import { listCampaignOptions } from "@/lib/attribution/resolve";
import { BookingsClient } from "./BookingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [bookings, campaigns] = await Promise.all([
    listBookings({ limit: 200 }).catch(() => []),
    // For the source override: staff pick a real campaign rather than typing a
    // tag, so a manual attribution can never be a slug that matches nothing.
    listCampaignOptions().catch(() => []),
  ]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <BookingsClient bookings={bookings} campaigns={campaigns} canExport={profile.role === "admin"} />
    </AppShell>
  );
}
