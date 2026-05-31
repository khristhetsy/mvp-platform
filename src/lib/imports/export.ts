import type { SupabaseClient } from "@supabase/supabase-js";
import {
  flattenReportForCsv,
  generateAdminReport,
  type AdminReportType,
} from "@/lib/reports/admin-reports";
import { rowsToCsv } from "@/lib/reports/export";
import { rowsToWorkbookBuffer } from "@/lib/imports/parse";
import type { ExportFormat, ExportType } from "@/lib/imports/types";

const EXPORT_REPORT_MAP: Partial<Record<ExportType, AdminReportType>> = {
  spv_readiness: "spv_readiness",
  compliance_events: "compliance",
  outreach_campaigns: "outreach_activity",
  due_diligence: "due_diligence",
  investor_activity: "investor_activity",
};

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "oauth",
  "google_token",
  "refresh_token",
  "access_token",
  "service_role",
  "file_path",
  "file_url",
  "body",
  "message_body",
  "encrypted",
  "secret",
]);

function sanitizeExportRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower) || [...SENSITIVE_KEYS].some((part) => lower.includes(part))) {
      continue;
    }
    if (typeof value === "string" && value.startsWith("storage/")) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function sanitizeRows(rows: Record<string, unknown>[]) {
  return rows.map(sanitizeExportRow);
}

async function exportCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, company_name, website, industry, revenue_stage, country, state, funding_amount, business_description, review_status, is_published, marketplace_visible, founder_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const founderIds = [...new Set((data ?? []).map((row) => row.founder_id))];
  const { data: founders } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", founderIds.length ? founderIds : ["00000000-0000-0000-0000-000000000000"]);

  const founderMap = new Map((founders ?? []).map((row) => [row.id, row.email]));

  return sanitizeRows(
    (data ?? []).map((row) => ({
      ...row,
      founder_email: founderMap.get(row.founder_id) ?? null,
    })),
  );
}

async function exportInvestors(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("investor_profiles")
    .select(
      "id, profile_id, investor_type, firm_name, check_size_min, check_size_max, preferred_sectors, preferred_stages, preferred_geographies, accredited_status, investment_thesis, contact_preference, approval_status, submitted_at, created_at, profiles:profile_id(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  return sanitizeRows(
    (data ?? []).map((row) => {
      const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
      return {
        id: row.id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        firm_name: row.firm_name,
        investor_type: row.investor_type,
        check_size_min: row.check_size_min,
        check_size_max: row.check_size_max,
        preferred_sectors: row.preferred_sectors,
        preferred_stages: row.preferred_stages,
        preferred_geographies: row.preferred_geographies,
        accredited_status: row.accredited_status,
        investment_thesis: row.investment_thesis,
        contact_preference: row.contact_preference,
        approval_status: row.approval_status,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
      };
    }),
  );
}

async function exportFounderContacts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("founder_investor_contacts")
    .select(
      "id, founder_id, company_id, investor_name, firm_name, email, phone, website, investor_type, preferred_sectors, preferred_stages, check_size_min, check_size_max, geography, source, tags, notes, linkedin_url, twitter_url, crunchbase_url, personal_website_url, other_social_url, status, created_at",
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const companyIds = [...new Set((data ?? []).map((row) => row.company_id))];
  const founderIds = [...new Set((data ?? []).map((row) => row.founder_id))];

  const [{ data: companies }, { data: founders }] = await Promise.all([
    supabase.from("companies").select("id, company_name").in("id", companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("profiles").select("id, email").in("id", founderIds.length ? founderIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));
  const founderMap = new Map((founders ?? []).map((row) => [row.id, row.email]));

  return sanitizeRows(
    (data ?? []).map((row) => ({
      founder_email: founderMap.get(row.founder_id) ?? null,
      company_name: companyMap.get(row.company_id) ?? null,
      investor_name: row.investor_name,
      firm_name: row.firm_name,
      email: row.email,
      phone: row.phone,
      website: row.website,
      investor_type: row.investor_type,
      preferred_sectors: row.preferred_sectors,
      preferred_stages: row.preferred_stages,
      check_size_min: row.check_size_min,
      check_size_max: row.check_size_max,
      geography: row.geography,
      source: row.source,
      tags: row.tags,
      notes: row.notes,
      linkedin_url: row.linkedin_url,
      twitter_url: row.twitter_url,
      crunchbase_url: row.crunchbase_url,
      personal_website_url: row.personal_website_url,
      other_social_url: row.other_social_url,
      status: row.status,
      created_at: row.created_at,
    })),
  );
}

export async function generateAdminExport(
  supabase: SupabaseClient,
  exportType: ExportType,
  format: ExportFormat,
) {
  if (exportType === "companies") {
    const rows = await exportCompanies(supabase);
    return buildExportPayload(exportType, format, rows);
  }

  if (exportType === "investors") {
    const rows = await exportInvestors(supabase);
    return buildExportPayload(exportType, format, rows);
  }

  if (exportType === "founder_contacts") {
    const rows = await exportFounderContacts(supabase);
    return buildExportPayload(exportType, format, rows);
  }

  const reportType = EXPORT_REPORT_MAP[exportType];
  if (!reportType) {
    throw new Error("Unsupported export type");
  }

  const payload = await generateAdminReport(supabase, { reportType, preview: false });
  const rows = sanitizeRows(flattenReportForCsv(payload));
  return buildExportPayload(exportType, format, rows, payload);
}

function buildExportPayload(
  exportType: ExportType,
  format: ExportFormat,
  rows: Record<string, unknown>[],
  jsonPayload?: unknown,
) {
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `capitalos-${exportType}-${stamp}`;

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      filename: `${baseName}.json`,
      body: JSON.stringify(jsonPayload ?? { rows, meta: { exportType, generatedAt: new Date().toISOString() } }, null, 2),
    };
  }

  if (format === "csv") {
    return {
      contentType: "text/csv; charset=utf-8",
      filename: `${baseName}.csv`,
      body: rowsToCsv(rows),
    };
  }

  const buffer = rowsToWorkbookBuffer(rows, exportType);
  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${baseName}.xlsx`,
    body: buffer,
  };
}
