import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile } from "@/lib/sales/contacts";
import { listAssignableStaff } from "@/lib/sales/settings";
import { listContactActivity } from "@/lib/sales/activity";
import { getSalesScope } from "@/lib/sales/scope";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContactProfileClient } from "./ContactProfileClient";

export const dynamic = "force-dynamic";

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const scope = await getSalesScope(profile);
  const data = await getContactProfile(id);
  if (!data) notFound();
  // Non-admins can only open contacts they own; only admins get the reassign control.
  if (!scope.isManager && data.contact.owner_id !== scope.ownerId) notFound();
  const staff = scope.isManager ? await listAssignableStaff() : [];
  const activity = await listContactActivity(id);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContactProfileClient contact={data.contact} opportunities={data.opportunities} staff={staff} activity={activity} />
    </AppShell>
  );
}
