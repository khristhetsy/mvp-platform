import { CRM_EXPORT_ENTITY_TYPES, CRM_EXPORT_FORMATS } from "@/lib/crm-connectors/types";
import type { CrmExportEntityType, CrmExportFormat } from "@/lib/crm-connectors/types";

const MAX_EXPORT_ROWS = 2000;

export function parseCrmExportEntityType(value: string | null): CrmExportEntityType | null {
  if (!value) return null;
  return CRM_EXPORT_ENTITY_TYPES.includes(value as CrmExportEntityType)
    ? (value as CrmExportEntityType)
    : null;
}

export function parseCrmExportFormat(value: string | null): CrmExportFormat {
  return value === "json" ? "json" : "csv";
}

export function validateExportRowCount(count: number): string | null {
  if (count === 0) return "No rows available for export.";
  if (count > MAX_EXPORT_ROWS) return `Export limited to ${MAX_EXPORT_ROWS} rows. Apply filters in a future release.`;
  return null;
}

export const CRM_EXPORT_WARNINGS = [
  "Phase 1: download package only — no live HubSpot API sync.",
  "Message bodies, documents, internal notes, and OAuth tokens are never exported.",
  "Review mapped fields before importing into your CRM.",
] as const;
