// Shared loader for the unified contact detail page, used by both the Sales Hub
// and Marketing Hub contact routes so they render the same record (crm_contacts)
// in their own shell. Returns null when the contact is missing or out of scope.
import { getContactProfile } from "@/lib/sales/contacts";
import { getSalesScope } from "@/lib/sales/scope";
import { listAssignableStaff, listLeadAssignableStaff } from "@/lib/sales/settings";
import { listContactActivity } from "@/lib/sales/activity";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { fetchPartnerMessages } from "@/lib/crm-connectors/odoo/messages";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";
import type { LinkedCompany } from "@/app/admin/sales/contacts/[id]/ContactProfileClient";

type ProfileLike = { id: string; email?: string | null; role?: string | null; is_super_admin?: boolean | null };

export async function loadContactPageProps(profile: ProfileLike, id: string) {
  const scope = await getSalesScope(profile);
  const data = await getContactProfile(id);
  if (!data) return null;
  if (!scope.canSeeAllContacts && !data.contact.assignee_ids.includes(scope.ownerId ?? "")) return null;

  const [staff, leadStaff] = scope.isManager
    ? await Promise.all([listAssignableStaff(), listLeadAssignableStaff()])
    : [[] as { id: string; name: string }[], [] as { id: string; name: string }[]];
  const activity = await listContactActivity(id);

  const odooMessages =
    data.contact.source === "odoo" && data.contact.external_id
      ? await fetchPartnerMessages(data.contact.external_id)
      : [];

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

  return {
    contact: data.contact,
    opportunities: data.opportunities,
    staff,
    leadStaff,
    activity,
    isSuperAdmin: isSuperAdmin(profile),
    onePager,
    company: linkedCompany,
    odooMessages,
  };
}
