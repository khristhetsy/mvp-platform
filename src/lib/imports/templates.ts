import type { ImportType } from "@/lib/imports/types";
import { IMPORT_FIELD_DEFINITIONS } from "@/lib/imports/types";
import { rowsToCsv } from "@/lib/reports/export";

const TEMPLATE_FILENAMES: Record<ImportType, string> = {
  companies: "company-import-template.csv",
  investors: "investor-import-template.csv",
  founder_contacts: "founder-contact-import-template.csv",
  social_links: "social-links-import-template.csv",
  crm_notes_tags: "crm-notes-tags-template.csv",
  outreach_contacts: "outreach-contact-list-template.csv",
};

export function getTemplateFilename(importType: ImportType): string {
  return TEMPLATE_FILENAMES[importType];
}

export function buildImportTemplateCsv(importType: ImportType): string {
  const fields = IMPORT_FIELD_DEFINITIONS[importType].map((f) => f.field);
  return rowsToCsv([Object.fromEntries(fields.map((field) => [field, ""]))]);
}
