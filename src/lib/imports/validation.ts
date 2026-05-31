import type { SupabaseClient } from "@supabase/supabase-js";
import { applyColumnMapping, autoMapColumns } from "@/lib/imports/column-mapping";
import type { ImportContextIndex } from "@/lib/imports/dedupe";
import { buildDuplicateKey, findExistingMatch } from "@/lib/imports/dedupe";
import type {
  ImportPreviewResult,
  ImportType,
  ParsedImportRow,
  ValidatedImportRow,
} from "@/lib/imports/types";
import { IMPORT_FIELD_DEFINITIONS } from "@/lib/imports/types";
import {
  isRiskyAutoStatus,
  isValidEmail,
  isValidUrl,
  parseNumeric,
} from "@/lib/imports/validators";

const URL_FIELDS = new Set([
  "website",
  "linkedin_url",
  "twitter_url",
  "crunchbase_url",
  "personal_website_url",
  "other_social_url",
]);

const NUMERIC_FIELDS = new Set(["funding_amount", "check_size_min", "check_size_max"]);

function validateRowForType(
  importType: ImportType,
  mapped: Record<string, string>,
  context: ImportContextIndex,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields = IMPORT_FIELD_DEFINITIONS[importType];

  for (const { field, required } of fields) {
    const value = mapped[field]?.trim() ?? "";
    if (required && !value) {
      errors.push(`${field} is required`);
    }
  }

  for (const field of ["founder_email", "email"]) {
    const value = mapped[field]?.trim();
    if (value && !isValidEmail(value)) {
      errors.push(`${field} is not a valid email`);
    }
  }

  for (const field of URL_FIELDS) {
    const value = mapped[field]?.trim();
    if (value && !isValidUrl(value)) {
      errors.push(`${field} is not a valid URL`);
    }
  }

  for (const field of NUMERIC_FIELDS) {
    const value = mapped[field]?.trim();
    if (value && parseNumeric(value) == null) {
      errors.push(`${field} must be numeric`);
    }
  }

  if (mapped.status && isRiskyAutoStatus(mapped.status)) {
    warnings.push(`status "${mapped.status}" will not auto-approve or publish records`);
  }

  if (importType === "companies") {
    const founderEmail = mapped.founder_email?.trim().toLowerCase();
    if (founderEmail && !context.founderEmails.has(founderEmail)) {
      errors.push(`founder_email "${founderEmail}" not found in platform`);
    }
  }

  if (importType === "founder_contacts" || importType === "outreach_contacts") {
    const founderEmail = mapped.founder_email?.trim().toLowerCase();
    const companyName = mapped.company_name?.trim().toLowerCase();
    if (founderEmail && companyName) {
      const key = `${founderEmail}::${companyName}`;
      if (!context.founderCompanyKeys.has(key)) {
        errors.push("founder_email + company_name combination not found");
      }
    }
  }

  if (importType === "social_links" || importType === "crm_notes_tags") {
    const entityType = mapped.entity_type?.trim().toLowerCase();
    if (entityType && !["company", "investor", "founder_contact"].includes(entityType)) {
      errors.push('entity_type must be "company", "investor", or "founder_contact"');
    }
    const identifier = mapped.entity_email_or_name?.trim().toLowerCase();
    if (entityType && identifier && !context.entityKeys.has(`${entityType}::${identifier}`)) {
      errors.push("entity_email_or_name not found for entity_type");
    }
  }

  const hasSocial =
    mapped.linkedin_url ||
    mapped.twitter_url ||
    mapped.crunchbase_url ||
    mapped.website ||
    mapped.personal_website_url ||
    mapped.other_social_url;

  if (importType === "social_links" && !hasSocial) {
    warnings.push("no social or website URLs provided");
  }

  if (importType === "crm_notes_tags" && !mapped.note?.trim() && !mapped.tags?.trim()) {
    warnings.push("no note or tags provided");
  }

  return { errors, warnings };
}

export function buildSuggestedMapping(headers: string[], importType: ImportType) {
  const targetFields = IMPORT_FIELD_DEFINITIONS[importType].map((field) => field.field);
  return autoMapColumns(headers, targetFields);
}

export function validateImportRows(input: {
  importType: ImportType;
  fileName: string;
  headers: string[];
  parsedRows: ParsedImportRow[];
  mapping: Record<string, string>;
  context: ImportContextIndex;
}): ImportPreviewResult {
  const seenKeys = new Map<string, number>();
  const rows: ValidatedImportRow[] = [];
  let duplicateCount = 0;

  for (const row of input.parsedRows) {
    const mapped = applyColumnMapping(row.raw, input.mapping);
    const { errors, warnings } = validateRowForType(input.importType, mapped, input.context);

    const unmappedHeaders = input.headers.filter((header) => !input.mapping[header]);
    if (unmappedHeaders.length > 0 && Object.keys(mapped).length === 0) {
      errors.push("row has no mapped columns");
    }

    let status: ValidatedImportRow["status"] = "valid";
    if (errors.length > 0) {
      status = "error";
    } else if (warnings.length > 0) {
      status = "warning";
    }

    const duplicateKey = errors.length === 0 ? buildDuplicateKey(input.importType, mapped, input.context) : undefined;
    if (duplicateKey) {
      if (seenKeys.has(duplicateKey)) {
        status = "error";
        errors.push(`duplicate row in file (matches row ${seenKeys.get(duplicateKey)})`);
        duplicateCount += 1;
      } else {
        seenKeys.set(duplicateKey, row.rowNumber);
        const existing = findExistingMatch(input.importType, mapped, input.context);
        if (existing) {
          if (status === "valid") status = "warning";
          warnings.push(`matches existing ${existing.entityType} record (${existing.actionHint})`);
          duplicateCount += 1;
        }
      }
    }

    rows.push({
      rowNumber: row.rowNumber,
      raw: row.raw,
      mapped,
      status,
      errors,
      warnings,
      duplicateKey,
    });
  }

  return {
    importType: input.importType,
    fileName: input.fileName,
    headers: input.headers,
    suggestedMapping: input.mapping,
    rows,
    counts: {
      total: rows.length,
      valid: rows.filter((row) => row.status === "valid").length,
      warning: rows.filter((row) => row.status === "warning").length,
      error: rows.filter((row) => row.status === "error").length,
      duplicate: duplicateCount,
    },
  };
}

export async function loadImportContext(
  supabase: SupabaseClient,
  importType: ImportType,
): Promise<ImportContextIndex> {
  const context: ImportContextIndex = {
    founderEmails: new Map(),
    founderCompanyKeys: new Set(),
    companyByDomain: new Map(),
    companyByNameFounder: new Map(),
    investorByEmail: new Map(),
    investorByFirmName: new Map(),
    founderContactKeys: new Map(),
    entityKeys: new Set(),
  };

  const [{ data: founders }, { data: companies }, { data: investors }, { data: contacts }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("role", "founder"),
    supabase.from("companies").select("id, founder_id, company_name, website"),
    supabase
      .from("investor_profiles")
      .select("id, profile_id, firm_name, profiles:profile_id(id, email, full_name)"),
    supabase
      .from("founder_investor_contacts")
      .select("id, founder_id, company_id, email, investor_name"),
  ]);

  for (const founder of founders ?? []) {
    if (founder.email) {
      context.founderEmails.set(founder.email.toLowerCase(), founder.id);
    }
  }

  for (const company of companies ?? []) {
    const founder = (founders ?? []).find((row) => row.id === company.founder_id);
    const founderEmail = founder?.email?.toLowerCase();
    if (founderEmail) {
      context.founderCompanyKeys.add(`${founderEmail}::${company.company_name.toLowerCase()}`);
    }
    context.companyByNameFounder.set(
      `${company.company_name.toLowerCase()}::${company.founder_id}`,
      company.id,
    );
    if (company.website) {
      const domain = company.website
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        ?.toLowerCase();
      if (domain) context.companyByDomain.set(domain, company.id);
    }
    if (founderEmail) {
      context.entityKeys.add(`company::${founderEmail}`);
    }
    context.entityKeys.add(`company::${company.company_name.toLowerCase()}`);
  }

  for (const investor of investors ?? []) {
    const profile = investor.profiles as unknown as { id: string; email: string | null; full_name: string | null } | null;
    if (profile?.email) {
      context.investorByEmail.set(profile.email.toLowerCase(), { profileId: profile.id, investorProfileId: investor.id });
      context.entityKeys.add(`investor::${profile.email.toLowerCase()}`);
    }
    if (profile?.full_name) {
      context.entityKeys.add(`investor::${profile.full_name.toLowerCase()}`);
    }
    const firm = investor.firm_name?.trim().toLowerCase();
    const name = profile?.full_name?.trim().toLowerCase();
    if (firm && name) {
      context.investorByFirmName.set(`${firm}::${name}`, investor.id);
    }
  }

  for (const contact of contacts ?? []) {
    const emailKey = contact.email?.toLowerCase();
    const key = `${contact.founder_id}::${contact.company_id}::${emailKey ?? contact.investor_name.toLowerCase()}`;
    context.founderContactKeys.set(key, contact.id);
    if (emailKey) {
      context.entityKeys.add(`founder_contact::${emailKey}`);
    }
    context.entityKeys.add(`founder_contact::${contact.investor_name.toLowerCase()}`);
  }

  if (importType === "founder_contacts" || importType === "outreach_contacts") {
    // founderCompanyKeys already populated
  }

  return context;
}
