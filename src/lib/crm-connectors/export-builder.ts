import {
  applyFieldMappings,
  extractDomainFromWebsite,
  formatCheckSizeRange,
  splitFullName,
} from "@/lib/crm-connectors/field-mapping";
import { getHubspotMappingsForEntity } from "@/lib/crm-connectors/hubspot-mapping";
import type { CrmExportEntityType, CrmExportFormat, CrmExportPackage } from "@/lib/crm-connectors/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const EXPORT_LIMIT = 2000;

async function latestReadinessByCompany(admin: ReturnType<typeof createServiceRoleClient>) {
  const { data } = await admin
    .from("diligence_reports")
    .select("company_id, readiness_score, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const map = new Map<string, number | null>();
  for (const row of data ?? []) {
    if (!map.has(row.company_id)) map.set(row.company_id, row.readiness_score);
  }
  return map;
}

export async function fetchRawCrmExportRows(entityType: CrmExportEntityType): Promise<Record<string, unknown>[]> {
  const admin = createServiceRoleClient();

  if (entityType === "companies") {
    const readiness = await latestReadinessByCompany(admin);
    const { data } = await admin
      .from("companies")
      .select("id, company_name, website, industry, funding_amount, review_status, country, status")
      .order("updated_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    return (data ?? []).map((c) => ({
      company_name: c.company_name,
      website_domain: extractDomainFromWebsite(c.website ?? null),
      industry: c.industry,
      funding_amount: c.funding_amount,
      review_status: c.review_status ?? c.status,
      readiness_score: readiness.get(c.id) ?? null,
      country: c.country,
      capitalos_company_id: c.id,
    }));
  }

  if (entityType === "investors") {
    const { data: investors } = await admin
      .from("investor_profiles")
      .select(
        "id, profile_id, investor_type, firm_name, check_size_min, check_size_max, preferred_sectors, approval_status",
      )
      .order("updated_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    const profileIds = (investors ?? []).map((i) => i.profile_id);
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", profileIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (investors ?? []).map((inv) => {
      const profile = profileById.get(inv.profile_id);
      const name = profile?.full_name ?? "Investor";
      const { firstname, lastname } = splitFullName(name);
      return {
        firstname,
        lastname,
        email: profile?.email ?? null,
        firm_name: inv.firm_name,
        investor_type: inv.investor_type,
        check_size_range: formatCheckSizeRange(inv.check_size_min, inv.check_size_max),
        preferred_sectors: (inv.preferred_sectors ?? []).join("; "),
        linkedin_url: null,
        approval_status: inv.approval_status,
        capitalos_record_id: inv.id,
      };
    });
  }

  if (entityType === "founder_investor_contacts") {
    const { data } = await admin
      .from("founder_investor_contacts")
      .select(
        "id, investor_name, email, firm_name, investor_type, check_size_min, check_size_max, preferred_sectors, linkedin_url, status",
      )
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    return (data ?? []).map((c) => {
      const { firstname, lastname } = splitFullName(c.investor_name);
      return {
        firstname,
        lastname,
        email: c.email,
        firm_name: c.firm_name,
        investor_type: c.investor_type,
        check_size_range: formatCheckSizeRange(c.check_size_min, c.check_size_max),
        preferred_sectors: c.preferred_sectors,
        linkedin_url: c.linkedin_url,
        approval_status: c.status,
        capitalos_record_id: c.id,
      };
    });
  }

  if (entityType === "crm_activity_summary") {
    const { data } = await admin
      .from("investor_activity")
      .select("investor_id, company_id, activity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    const buckets = new Map<string, { count: number; latest: string }>();
    for (const row of data ?? []) {
      const key = `${row.investor_id}|${row.company_id}|${row.activity_type}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, { count: 1, latest: row.created_at });
      } else {
        existing.count += 1;
        if (row.created_at > existing.latest) existing.latest = row.created_at;
      }
    }

    return Array.from(buckets.entries()).map(([key, meta]) => {
      const [investor_id, company_id, activity_type] = key.split("|");
      return {
        activity_type,
        company_id,
        investor_id,
        occurred_at: meta.latest,
        activity_count: meta.count,
      };
    });
  }

  if (entityType === "outreach_contact_lists") {
    const { data: targets } = await admin
      .from("founder_outreach_targets")
      .select("id, contact_id, status, match_score, source, company_id")
      .order("updated_at", { ascending: false })
      .limit(EXPORT_LIMIT);

    const contactIds = (targets ?? []).map((t) => t.contact_id).filter(Boolean) as string[];
    const { data: contacts } = contactIds.length
      ? await admin
          .from("founder_investor_contacts")
          .select("id, investor_name, email, firm_name")
          .in("id", contactIds)
      : { data: [] };

    const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

    return (targets ?? []).map((t) => {
      const contact = t.contact_id ? contactById.get(t.contact_id) : null;
      const name = contact?.investor_name ?? "Contact";
      const { firstname, lastname } = splitFullName(name);
      return {
        firstname,
        lastname,
        email: contact?.email ?? null,
        firm_name: contact?.firm_name ?? null,
        target_status: t.status,
        match_score: t.match_score,
        source: t.source,
        capitalos_target_id: t.id,
      };
    });
  }

  return [];
}

export function mapRowsToHubspot(
  entityType: CrmExportEntityType,
  rawRows: Record<string, unknown>[],
): Record<string, string | number | null>[] {
  const mappings = getHubspotMappingsForEntity(entityType);
  return rawRows.map((row) => applyFieldMappings(row, mappings).mapped);
}

export async function buildCrmExportPackage(
  entityType: CrmExportEntityType,
  format: CrmExportFormat,
): Promise<CrmExportPackage> {
  const rawRows = await fetchRawCrmExportRows(entityType);
  const mappedRows = mapRowsToHubspot(entityType, rawRows);
  const headers =
    mappedRows.length > 0 ? Object.keys(mappedRows[0]) : getHubspotMappingsForEntity(entityType).map((m) => m.hubspotField);

  return {
    entityType,
    format,
    rowCount: mappedRows.length,
    headers,
    rows: mappedRows,
    generatedAt: new Date().toISOString(),
  };
}

export function crmPackageToCsv(pkg: CrmExportPackage): string {
  const escape = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [pkg.headers.join(",")];
  for (const row of pkg.rows) {
    lines.push(pkg.headers.map((h) => escape(row[h] ?? null)).join(","));
  }
  return lines.join("\n");
}

export function crmPackageToJson(pkg: CrmExportPackage): string {
  return JSON.stringify(
    {
      exportedAt: pkg.generatedAt,
      entityType: pkg.entityType,
      rowCount: pkg.rowCount,
      hubspotFieldMapping: true,
      liveSync: false,
      rows: pkg.rows,
    },
    null,
    2,
  );
}
