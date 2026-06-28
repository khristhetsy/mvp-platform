import type { CrmExportEntityType } from "@/lib/crm-connectors/types";

export type HubspotFieldDef = {
  sourceField: string;
  hubspotField: string;
  label: string;
};

export const HUBSPOT_COMPANY_FIELDS: HubspotFieldDef[] = [
  { sourceField: "company_name", hubspotField: "name", label: "Company name" },
  { sourceField: "website_domain", hubspotField: "domain", label: "Domain" },
  { sourceField: "industry", hubspotField: "industry", label: "Industry" },
  { sourceField: "funding_amount", hubspotField: "capitalos_target_raise", label: "Target raise" },
  { sourceField: "review_status", hubspotField: "capitalos_review_status", label: "Review status" },
  { sourceField: "readiness_score", hubspotField: "capitalos_readiness_score", label: "Readiness score" },
  { sourceField: "country", hubspotField: "country", label: "Country" },
  { sourceField: "capitalos_company_id", hubspotField: "capitalos_company_id", label: "iCapOS ID" },
];

export const HUBSPOT_CONTACT_FIELDS: HubspotFieldDef[] = [
  { sourceField: "firstname", hubspotField: "firstname", label: "First name" },
  { sourceField: "lastname", hubspotField: "lastname", label: "Last name" },
  { sourceField: "email", hubspotField: "email", label: "Email" },
  { sourceField: "firm_name", hubspotField: "company", label: "Company / firm" },
  { sourceField: "investor_type", hubspotField: "capitalos_investor_type", label: "Investor type" },
  { sourceField: "check_size_range", hubspotField: "capitalos_check_size_range", label: "Check size range" },
  { sourceField: "preferred_sectors", hubspotField: "capitalos_preferred_sectors", label: "Preferred sectors" },
  { sourceField: "linkedin_url", hubspotField: "linkedinbio", label: "LinkedIn" },
  { sourceField: "approval_status", hubspotField: "capitalos_approval_status", label: "Approval status" },
  { sourceField: "capitalos_record_id", hubspotField: "capitalos_record_id", label: "iCapOS ID" },
];

export const HUBSPOT_ACTIVITY_FIELDS: HubspotFieldDef[] = [
  { sourceField: "activity_type", hubspotField: "capitalos_activity_type", label: "Activity type" },
  { sourceField: "company_id", hubspotField: "capitalos_company_id", label: "Company ID" },
  { sourceField: "investor_id", hubspotField: "capitalos_investor_id", label: "Investor ID" },
  { sourceField: "occurred_at", hubspotField: "capitalos_occurred_at", label: "Occurred at" },
  { sourceField: "activity_count", hubspotField: "capitalos_activity_count", label: "Count" },
];

export const HUBSPOT_OUTREACH_FIELDS: HubspotFieldDef[] = [
  { sourceField: "firstname", hubspotField: "firstname", label: "First name" },
  { sourceField: "lastname", hubspotField: "lastname", label: "Last name" },
  { sourceField: "email", hubspotField: "email", label: "Email" },
  { sourceField: "firm_name", hubspotField: "company", label: "Firm" },
  { sourceField: "target_status", hubspotField: "capitalos_outreach_status", label: "Outreach status" },
  { sourceField: "match_score", hubspotField: "capitalos_match_score", label: "Match score" },
  { sourceField: "source", hubspotField: "capitalos_source", label: "Source" },
  { sourceField: "capitalos_target_id", hubspotField: "capitalos_target_id", label: "Target ID" },
];

export function getHubspotMappingsForEntity(entityType: CrmExportEntityType): HubspotFieldDef[] {
  switch (entityType) {
    case "companies":
      return HUBSPOT_COMPANY_FIELDS;
    case "investors":
    case "founder_investor_contacts":
      return HUBSPOT_CONTACT_FIELDS;
    case "crm_activity_summary":
      return HUBSPOT_ACTIVITY_FIELDS;
    case "outreach_contact_lists":
      return HUBSPOT_OUTREACH_FIELDS;
    default:
      return [];
  }
}
