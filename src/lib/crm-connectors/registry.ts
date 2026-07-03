import type { ContactSource } from "@/lib/crm-connectors/source-types";
import { odooSource } from "@/lib/crm-connectors/odoo/adapter";

// The registry of available contact sources. Add HubSpot / Salesforce / CSV
// adapters here — the mirror, engine, cron, and admin UI need no changes.
const SOURCES: ContactSource[] = [odooSource];

export function listSources(): { id: string; label: string; configured: boolean }[] {
  return SOURCES.map((s) => ({ id: s.id, label: s.label, configured: s.isConfigured() }));
}

export function getSource(id: string): ContactSource | null {
  return SOURCES.find((s) => s.id === id) ?? null;
}

export function configuredSources(): ContactSource[] {
  return SOURCES.filter((s) => s.isConfigured());
}
