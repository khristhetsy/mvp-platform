import type { CrmExportEntityType } from "@/lib/crm-connectors/types";

export const CRM_ENTITY_LABELS: Record<CrmExportEntityType, string> = {
  companies: "Companies",
  investors: "Platform investors",
  founder_investor_contacts: "Founder investor contacts",
  crm_activity_summary: "CRM activity summary",
  outreach_contact_lists: "Outreach contact lists",
};

export function crmEntityLabel(entityType: CrmExportEntityType): string {
  return CRM_ENTITY_LABELS[entityType] ?? entityType;
}
