// Source-agnostic contact connector layer. Every external system (Odoo,
// HubSpot, Salesforce, CSV, …) implements ContactSource; everything downstream
// — the crm_contacts mirror, the sync engine, the admin UI — stays identical.

export type SourceId = "odoo" | "hubspot" | "csv";
export type ContactModule = "founder" | "investor" | "unknown";

/** Normalized contact shape written to the crm_contacts mirror. */
export interface CrmContact {
  source: SourceId;
  externalId: string;
  module: ContactModule;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  owner: string | null;
  plan: string | null;
  tags: string[];
  raw: Record<string, unknown>;
}

export interface SourcePage {
  contacts: CrmContact[];
  nextCursor: string | null;
}

/** The contract each connector implements. */
export interface ContactSource {
  id: SourceId;
  label: string;
  /** True when the required env/config for this source is present. */
  isConfigured(): boolean;
  /** Auth + a cheap count, for the connection card. */
  test(): Promise<{ ok: boolean; count: number; error?: string }>;
  /** One page of the full backfill. `cursor` is opaque; null starts over. */
  fetchPage(cursor: string | null, pageSize: number): Promise<SourcePage>;
  /** Records changed since an ISO timestamp (incremental sync). */
  fetchDelta(sinceIso: string): Promise<CrmContact[]>;
}
