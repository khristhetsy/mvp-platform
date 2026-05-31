export const IMPORT_TYPES = [
  "companies",
  "investors",
  "founder_contacts",
  "social_links",
  "crm_notes_tags",
  "outreach_contacts",
] as const;

export type ImportType = (typeof IMPORT_TYPES)[number];

export const EXPORT_TYPES = [
  "companies",
  "investors",
  "founder_contacts",
  "spv_readiness",
  "compliance_events",
  "outreach_campaigns",
  "due_diligence",
  "investor_activity",
] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];

export type ExportFormat = "csv" | "xlsx" | "json";

export type ImportRowStatus = "valid" | "warning" | "error" | "skipped" | "created" | "updated" | "failed";

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
};

export type ValidatedImportRow = ParsedImportRow & {
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  duplicateKey?: string;
};

export type ImportPreviewResult = {
  importType: ImportType;
  fileName: string;
  headers: string[];
  suggestedMapping: Record<string, string>;
  rows: ValidatedImportRow[];
  counts: {
    total: number;
    valid: number;
    warning: number;
    error: number;
    duplicate: number;
  };
};

export const IMPORT_FIELD_DEFINITIONS: Record<ImportType, { field: string; required?: boolean }[]> = {
  companies: [
    { field: "company_name", required: true },
    { field: "founder_email", required: true },
    { field: "website" },
    { field: "industry" },
    { field: "revenue_stage" },
    { field: "country" },
    { field: "state" },
    { field: "funding_amount" },
    { field: "business_description" },
    { field: "linkedin_url" },
    { field: "twitter_url" },
    { field: "crunchbase_url" },
    { field: "notes" },
    { field: "tags" },
  ],
  investors: [
    { field: "email", required: true },
    { field: "full_name", required: true },
    { field: "firm_name" },
    { field: "investor_type" },
    { field: "check_size_min" },
    { field: "check_size_max" },
    { field: "preferred_sectors" },
    { field: "preferred_stages" },
    { field: "preferred_geographies" },
    { field: "accredited_status" },
    { field: "investment_thesis" },
    { field: "contact_preference" },
    { field: "linkedin_url" },
    { field: "twitter_url" },
    { field: "crunchbase_url" },
    { field: "website" },
    { field: "notes" },
    { field: "tags" },
  ],
  founder_contacts: [
    { field: "founder_email", required: true },
    { field: "company_name", required: true },
    { field: "investor_name", required: true },
    { field: "email" },
    { field: "firm_name" },
    { field: "phone" },
    { field: "website" },
    { field: "investor_type" },
    { field: "preferred_sectors" },
    { field: "preferred_stages" },
    { field: "check_size_min" },
    { field: "check_size_max" },
    { field: "geography" },
    { field: "source" },
    { field: "tags" },
    { field: "notes" },
    { field: "linkedin_url" },
    { field: "twitter_url" },
    { field: "crunchbase_url" },
    { field: "personal_website_url" },
    { field: "other_social_url" },
  ],
  social_links: [
    { field: "entity_type", required: true },
    { field: "entity_email_or_name", required: true },
    { field: "linkedin_url" },
    { field: "twitter_url" },
    { field: "crunchbase_url" },
    { field: "website" },
    { field: "personal_website_url" },
    { field: "other_social_url" },
  ],
  crm_notes_tags: [
    { field: "entity_type", required: true },
    { field: "entity_email_or_name", required: true },
    { field: "note" },
    { field: "tags" },
    { field: "status" },
    { field: "source" },
  ],
  outreach_contacts: [
    { field: "founder_email", required: true },
    { field: "company_name", required: true },
    { field: "investor_name", required: true },
    { field: "email" },
    { field: "firm_name" },
    { field: "linkedin_url" },
    { field: "source" },
    { field: "tags" },
    { field: "notes" },
  ],
};

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  companies: "Companies",
  investors: "Platform investors",
  founder_contacts: "Founder-owned investor contacts",
  social_links: "Social / profile links",
  crm_notes_tags: "CRM notes & tags",
  outreach_contacts: "Outreach contact lists",
};
