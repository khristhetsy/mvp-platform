import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile } from "@/lib/sales/contacts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAssignableStaff, listLeadAssignableStaff } from "@/lib/sales/settings";
import { listContactActivity } from "@/lib/sales/activity";
import { getSalesScope } from "@/lib/sales/scope";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContactProfileClient, type LinkedCompany } from "./ContactProfileClient";

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

  // Link this CRM contact to a platform company (by the founder's email) so we can
  // show their linked company record + One pager. Null when there's no account.
  let onePager: { slug: string | null; published: boolean; companyName: string | null } | null = null;
  let linkedCompany: LinkedCompany | null = null;
  if (data.contact.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data: prof } = await admin.from("profiles").select("id").eq("email", data.contact.email).maybeSingle();
    if (prof?.id) {
      const { data: comp } = await admin
        .from("companies")
        .select("slug, is_published, company_name, industry, revenue_stage, funding_amount, business_description, website, country, state, use_of_funds")
        .eq("founder_id", prof.id)
        .maybeSingle();
      if (comp) {
        onePager = { slug: comp.slug ?? null, published: Boolean(comp.is_published), companyName: comp.company_name ?? null };
        linkedCompany = {
          companyName: comp.company_name ?? null,
          industry: comp.industry ?? null,
          revenueStage: comp.revenue_stage ?? null,
          fundingAmount: comp.funding_amount ?? null,
          description: comp.business_description ?? null,
          website: comp.website ?? null,
          country: comp.country ?? null,
          state: comp.state ?? null,
          useOfFunds: comp.use_of_funds ?? null,
        };
      }
    }
  }

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ContactProfileClient contact={data.contact} opportunities={data.opportunities} staff={staff} leadStaff={leadStaff} activity={activity} isSuperAdmin={isSuperAdmin(profile)} onePager={onePager} company={linkedCompany} />
    </AppShell>
  );
}
