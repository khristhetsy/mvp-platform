import { applyFieldMappings } from "@/lib/crm-connectors/field-mapping";
import { CRM_PRIVACY_EXCLUDED_SOURCES } from "@/lib/crm-connectors/field-mapping";
import { getHubspotMappingsForEntity } from "@/lib/crm-connectors/hubspot-mapping";
import { fetchRawCrmExportRows } from "@/lib/crm-connectors/export-builder";
import type { CrmExportEntityType, CrmExportPreview } from "@/lib/crm-connectors/types";
import { CRM_EXPORT_WARNINGS } from "@/lib/crm-connectors/validation";

const SAMPLE_SIZE = 3;

export async function buildCrmExportPreview(entityType: CrmExportEntityType): Promise<CrmExportPreview> {
  const rawRows = await fetchRawCrmExportRows(entityType);
  const mappings = getHubspotMappingsForEntity(entityType);

  const aggregateFields = new Map<string, { exported: number; skipped: number; skippedReason?: string }>();
  for (const m of mappings) {
    aggregateFields.set(m.hubspotField, { exported: 0, skipped: 0 });
  }

  const sample = rawRows.slice(0, SAMPLE_SIZE);
  for (const row of sample) {
    const { fieldResults } = applyFieldMappings(row, mappings);
    for (const fr of fieldResults) {
      const agg = aggregateFields.get(fr.hubspotField);
      if (!agg) continue;
      if (fr.exported) agg.exported += 1;
      else {
        agg.skipped += 1;
        if (fr.skippedReason && !agg.skippedReason) agg.skippedReason = fr.skippedReason;
      }
    }
  }

  const mappedFields = mappings.map((m) => {
    const agg = aggregateFields.get(m.hubspotField);
    const exported = (agg?.exported ?? 0) > 0;
    return {
      sourceField: m.sourceField,
      hubspotField: m.hubspotField,
      label: m.label,
      exported,
      skippedReason: exported ? undefined : agg?.skippedReason ?? "No sample data",
    };
  });

  const warnings: string[] = [...CRM_EXPORT_WARNINGS];
  if (rawRows.length === 0) warnings.push("No records found for this entity type.");
  if (rawRows.length >= 2000) warnings.push("Export capped at 2000 rows.");

  return {
    entityType,
    rowCount: rawRows.length,
    sampleRowCount: sample.length,
    mappedFields,
    warnings,
    privacyExclusions: [...CRM_PRIVACY_EXCLUDED_SOURCES],
    liveSyncEnabled: false,
    hubspotReady: true,
  };
}
