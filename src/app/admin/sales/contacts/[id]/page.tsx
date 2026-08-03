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
        .select("id, slug, is_published, company_name, industry, revenue_stage, funding_amount, business_description, website, country, state, use_of_funds")
        .eq("founder_id", prof.id)
        .maybeSingle();
      if (comp) {
        onePager = { slug: comp.slug ?? null, published: Boolean(comp.is_published), companyName: comp.company_name ?? null };
        linkedCompany = {
          id: comp.id,
          companyName: comp.company_name ?? null,
          industry: comp.industry ?? null,
          revenueStage: comp.revenue_stage ?? null,
          fundingAmount: comp.funding_amount ?? null,
          description: comp.business_description ?? null,
          website: comp.website ?? null,
          country: comp.country ?? null,
          state: comp.state ?? null,
          useOfFunds: comp.use_of_funds ?? null,
          fundingStage: null, operatingStage: null, businessEntity: null,
          annualEbitda: null, managementTeam: null, seekingInvestorTypes: null,
          seekingCapitalTypes: null, activeInvestorPreference: null,
        };
        // Seeking + Company & stage columns (migration 20260803002). Best-effort:
        // a separate select so the section still renders if the migration hasn't
        // run yet (unknown columns return an error, not throw).
        const { data: extra } = await admin
          .from("companies")
          .select("funding_stage, operating_stage, business_entity, annual_ebitda, management_team, seeking_investor_types, seeking_capital_types, active_investor_preference")
          .eq("founder_id", prof.id)
          .maybeSingle();
        if (extra) {
          linkedCompany.fundingStage = extra.funding_stage ?? null;
          linkedCompany.operatingStage = extra.operating_stage ?? null;
          linkedCompany.businessEntity = extra.business_entity ?? null;
          linkedCompany.annualEbitda = extra.annual_ebitda ?? null;
          linkedCompany.managementTeam = extra.management_team ?? null;
          linkedCompany.seekingInvestorTypes = extra.seeking_investor_types ?? null;
          linkedCompany.seekingCapitalTypes = extra.seeking_capital_types ?? null;
          linkedCompany.activeInvestorPreference = extra.active_investor_preference ?? null;
        }
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
