import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile } from "@/lib/sales/contacts";
import { listAssignableStaff, listLeadAssignableStaff } from "@/lib/sales/settings";
import { listContactActivity } from "@/lib/sales/activity";
import { getSalesScope } from "@/lib/sales/scope";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContactProfileClient } from "./ContactProfileClient";

export const dynamic = "force-dynamic";

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const scope = await getSalesScope(profile);
  const data = await getContactProfile(id);
  if (!data) notFound();
  // Scoped users can only open contacts they are Lead-assigned to; admins and
  // "see all contacts" departments (e.g. Marketing) can open any contact.
  if (!scope.canSeeAllContacts && !data.contact.assignee_ids.includes(scope.ownerId ?? "")) notFound();
  // Owner picker = all staff; Assigned-to picker = only lead-assignable members (Feature Controls).
  const [staff, leadStaff] = scope.isManager
    ? await Promise.all([listAssignableStaff(), listLeadAssignableStaff()])
    : [[] as { id: string; name: string }[], [] as { id: string; name: string }[]];
  const activity = await listContactActivity(id);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContactProfileClient contact={data.contact} opportunities={data.opportunities} staff={staff} leadStaff={leadStaff} activity={activity} isSuperAdmin={isSuperAdmin(profile)} />
    </AppShell>
  );
}
