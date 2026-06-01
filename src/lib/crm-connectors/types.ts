export const CRM_EXPORT_ENTITY_TYPES = [
  "companies",
  "investors",
  "founder_investor_contacts",
  "crm_activity_summary",
  "outreach_contact_lists",
] as const;

export type CrmExportEntityType = (typeof CRM_EXPORT_ENTITY_TYPES)[number];

export const CRM_EXPORT_FORMATS = ["csv", "json"] as const;

export type CrmExportFormat = (typeof CRM_EXPORT_FORMATS)[number];

export type CrmFieldMapping = {
  sourceField: string;
  hubspotField: string;
  label: string;
  exported: boolean;
  skippedReason?: string;
};

export type CrmExportPreview = {
  entityType: CrmExportEntityType;
  rowCount: number;
  sampleRowCount: number;
  mappedFields: CrmFieldMapping[];
  warnings: string[];
  privacyExclusions: string[];
  liveSyncEnabled: false;
  hubspotReady: true;
};

export type CrmExportPackage = {
  entityType: CrmExportEntityType;
  format: CrmExportFormat;
  rowCount: number;
  headers: string[];
  rows: Record<string, string | number | null>[];
  generatedAt: string;
};
