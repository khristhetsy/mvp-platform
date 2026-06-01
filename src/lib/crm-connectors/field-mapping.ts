import type { CrmFieldMapping } from "@/lib/crm-connectors/types";

export const CRM_PRIVACY_EXCLUDED_SOURCES = [
  "notes",
  "admin_feedback",
  "investment_thesis",
  "business_description",
  "use_of_funds",
  "team_summary",
  "cap_table_summary",
  "file_path",
  "file_url",
  "message",
  "body",
  "content",
  "metadata",
  "access_token",
  "refresh_token",
] as const;

export function isExcludedSourceField(field: string): boolean {
  const lower = field.toLowerCase();
  return CRM_PRIVACY_EXCLUDED_SOURCES.some((ex) => lower === ex || lower.includes(ex));
}

export function applyFieldMappings(
  source: Record<string, unknown>,
  mappings: Array<{ sourceField: string; hubspotField: string; label: string }>,
): { mapped: Record<string, string | number | null>; fieldResults: CrmFieldMapping[] } {
  const mapped: Record<string, string | number | null> = {};
  const fieldResults: CrmFieldMapping[] = [];

  for (const m of mappings) {
    if (isExcludedSourceField(m.sourceField)) {
      fieldResults.push({
        sourceField: m.sourceField,
        hubspotField: m.hubspotField,
        label: m.label,
        exported: false,
        skippedReason: "Privacy exclusion",
      });
      continue;
    }

    const raw = source[m.sourceField];
    if (raw === undefined || raw === null || raw === "") {
      fieldResults.push({
        sourceField: m.sourceField,
        hubspotField: m.hubspotField,
        label: m.label,
        exported: false,
        skippedReason: "No value",
      });
      continue;
    }

    let value: string | number | null;
    if (Array.isArray(raw)) {
      value = raw.join("; ");
    } else if (typeof raw === "object") {
      fieldResults.push({
        sourceField: m.sourceField,
        hubspotField: m.hubspotField,
        label: m.label,
        exported: false,
        skippedReason: "Complex value excluded",
      });
      continue;
    } else {
      value = String(raw).slice(0, 500);
    }

    mapped[m.hubspotField] = value;
    fieldResults.push({
      sourceField: m.sourceField,
      hubspotField: m.hubspotField,
      label: m.label,
      exported: true,
    });
  }

  return { mapped, fieldResults };
}

export function splitFullName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export function formatCheckSizeRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}-${max}`;
  if (min != null) return `${min}+`;
  return `up to ${max}`;
}

export function extractDomainFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}
