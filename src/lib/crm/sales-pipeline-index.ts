/**
 * Which CRM records are in the sales pipeline: any sales opportunity links to them,
 * by CRM contact id, contact email, platform profile or company. Same rule as the
 * Contacts search "Sales opportunity" filter (contact_in_sales_pipeline), widened to
 * the profile and company links the CRM Console records carry. Any status counts.
 */
export type SalesOppLink = { contact_crm_id: string | null; contact_email: string | null; contact_profile_id: string | null; company_id: string | null };
export type SalesPipelineIndex = { crmIds: Set<string>; emails: Set<string>; profileIds: Set<string>; companyIds: Set<string> };

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

export function buildSalesPipelineIndex(rows: readonly SalesOppLink[]): SalesPipelineIndex {
  const idx: SalesPipelineIndex = { crmIds: new Set(), emails: new Set(), profileIds: new Set(), companyIds: new Set() };
  for (const r of rows) {
    if (r.contact_crm_id) idx.crmIds.add(String(r.contact_crm_id));
    if (norm(r.contact_email)) idx.emails.add(norm(r.contact_email));
    if (r.contact_profile_id) idx.profileIds.add(String(r.contact_profile_id));
    if (r.company_id) idx.companyIds.add(String(r.company_id));
  }
  return idx;
}

export function inSalesPipeline(idx: SalesPipelineIndex, k: { crmId?: unknown; email?: unknown; profileId?: unknown; companyId?: unknown }): boolean {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (!!s(k.crmId) && idx.crmIds.has(s(k.crmId)))
    || (!!norm(s(k.email)) && idx.emails.has(norm(s(k.email))))
    || (!!s(k.profileId) && idx.profileIds.has(s(k.profileId)))
    || (!!s(k.companyId) && idx.companyIds.has(s(k.companyId)));
}
