import { CRM_ENTITY_LABELS } from "@/lib/crm-connectors/display";
import { getHubspotMappingsForEntity } from "@/lib/crm-connectors/hubspot-mapping";
import { CRM_EXPORT_ENTITY_TYPES } from "@/lib/crm-connectors/types";

export function isCrmExportIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("hubspot") ||
    lower.includes("crm export") ||
    (lower.includes("crm") && (lower.includes("export") || lower.includes("sync") || lower.includes("field")))
  );
}

export function formatCrmExportForAssistant(message: string): string {
  const lower = message.toLowerCase();
  const lines: string[] = ["**CRM export connector (Phase 1)**", ""];

  if (lower.includes("sync") || lower.includes("live")) {
    lines.push(
      "**Live CRM sync is not enabled.** You can download sanitized CSV or JSON export packages for manual import into HubSpot or another CRM.",
    );
  }

  if (lower.includes("export") || lower.includes("hubspot")) {
    lines.push(
      "**Export is supported** for: " +
        CRM_EXPORT_ENTITY_TYPES.map((t) => CRM_ENTITY_LABELS[t]).join(", ") +
        ".",
    );
    lines.push("Use **Admin → Import / Export** or **Admin → Integrations** → CRM Export Connector.");
  }

  if (lower.includes("field") || lower.includes("mapping") || lower.includes("supported")) {
    const companyFields = getHubspotMappingsForEntity("companies")
      .map((m) => `${m.sourceField} → ${m.hubspotField}`)
      .join(", ");
    const contactFields = getHubspotMappingsForEntity("investors")
      .slice(0, 6)
      .map((m) => `${m.sourceField} → ${m.hubspotField}`)
      .join(", ");
    lines.push(`**Company mapping (sample):** ${companyFields}.`);
    lines.push(`**Contact mapping (sample):** ${contactFields}, …`);
  }

  lines.push(
    "",
    "**Privacy:** Message bodies, documents, internal/legal notes, and OAuth tokens are never exported.",
    "**No auto-outreach** — export packages only.",
  );

  return lines.join("\n");
}
