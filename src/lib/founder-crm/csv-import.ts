import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";

export type CsvImportRow = {
  investor_name?: string;
  firm_name?: string;
  email?: string;
  phone?: string;
  investor_type?: string;
  sector?: string;
  stage?: string;
  check_size?: string;
  geography?: string;
  website?: string;
  linkedin_url?: string;
  twitter_url?: string;
  crunchbase_url?: string;
  personal_website_url?: string;
  other_social_url?: string;
  notes?: string;
};

export type ParsedCsvRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: {
    investor_name: string;
    firm_name: string | null;
    email: string | null;
    phone: string | null;
    investor_type: string | null;
    preferred_sectors: string | null;
    preferred_stages: string | null;
    check_size_min: number | null;
    check_size_max: number | null;
    geography: string | null;
    website: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    crunchbase_url: string | null;
    personal_website_url: string | null;
    other_social_url: string | null;
    notes: string | null;
  } | null;
};

function parseCheckSize(value: string | undefined) {
  if (!value?.trim()) {
    return { min: null, max: null };
  }

  const cleaned = value.replace(/[$,\s]/g, "").toLowerCase();

  // Parse each number with its OWN unit suffix (k/m) so mixed-unit ranges like
  // "500k-2m" are handled correctly. A single global multiplier (the previous
  // approach) turned "$500K-$2M" into $500M-$2M.
  const numbers: number[] = [];
  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)([km]?)/g)) {
    const base = Number(match[1]);
    if (Number.isNaN(base)) continue;
    const multiplier = match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
    numbers.push(base * multiplier);
  }

  if (numbers.length === 0) {
    return { min: null, max: null };
  }

  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0] };
  }

  return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
}

export function parseCsvImportRows(rows: CsvImportRow[]): ParsedCsvRow[] {
  return rows.map((row, index) => {
    const errors: string[] = [];
    const name = row.investor_name?.trim();

    if (!name) {
      errors.push("investor_name is required");
    }

    const email = row.email?.trim().toLowerCase() || null;
    if (email && !email.includes("@")) {
      errors.push("email is invalid");
    }

    const check = parseCheckSize(row.check_size);

    return {
      rowNumber: index + 1,
      valid: errors.length === 0 && Boolean(name),
      errors,
      data:
        errors.length === 0 && name
          ? {
              investor_name: name,
              firm_name: row.firm_name?.trim() || null,
              email,
              phone: row.phone?.trim() || null,
              investor_type: row.investor_type?.trim() || null,
              preferred_sectors: row.sector?.trim() || null,
              preferred_stages: row.stage?.trim() || null,
              check_size_min: check.min,
              check_size_max: check.max,
              geography: row.geography?.trim() || null,
              website: row.website?.trim() || null,
              linkedin_url: row.linkedin_url?.trim() || null,
              twitter_url: row.twitter_url?.trim() || null,
              crunchbase_url: row.crunchbase_url?.trim() || null,
              personal_website_url: row.personal_website_url?.trim() || null,
              other_social_url: row.other_social_url?.trim() || null,
              notes: row.notes?.trim() || null,
            }
          : null,
    };
  });
}

export function dedupeImportRows(
  parsed: ParsedCsvRow[],
  existing: FounderInvestorContactRecord[],
) {
  const existingEmails = new Set(
    existing.map((row) => row.email?.toLowerCase()).filter(Boolean) as string[],
  );

  const seen = new Set<string>();
  return parsed.map((row) => {
    if (!row.valid || !row.data?.email) {
      return { ...row, duplicate: false, existing: false, skipped: false };
    }

    const email = row.data.email;
    if (existingEmails.has(email)) {
      // Already one of the founder's contacts. The import route either skips it
      // or fills its empty fields, depending on the founder's choice.
      return { ...row, duplicate: true, existing: true, skipped: true };
    }
    if (seen.has(email)) {
      return { ...row, duplicate: true, existing: false, skipped: true };
    }

    seen.add(email);
    return { ...row, duplicate: false, existing: false, skipped: false };
  });
}

type ParsedData = NonNullable<ParsedCsvRow["data"]>;

/** Fields that can be filled on a contact the founder already holds. */
export const FILLABLE_FIELDS = [
  "firm_name",
  "phone",
  "website",
  "investor_type",
  "preferred_sectors",
  "preferred_stages",
  "geography",
  "linkedin_url",
  "twitter_url",
  "crunchbase_url",
  "personal_website_url",
  "other_social_url",
  "notes",
] as const;

export type FillableField = (typeof FILLABLE_FIELDS)[number] | "check_size";

function isEmpty(value: string | null | undefined) {
  return !value || !value.trim();
}

/**
 * What an import row can add to a contact that already exists: only fields the
 * contact has empty. Anything the founder already has is never overwritten,
 * and the name and email never change.
 */
export function fillEmptyPatch(
  existing: Pick<
    FounderInvestorContactRecord,
    | "firm_name" | "phone" | "website" | "investor_type" | "preferred_sectors" | "preferred_stages"
    | "geography" | "linkedin_url" | "twitter_url" | "crunchbase_url" | "personal_website_url"
    | "other_social_url" | "notes" | "check_size_min" | "check_size_max"
  >,
  incoming: ParsedData,
) {
  const patch: Partial<Record<(typeof FILLABLE_FIELDS)[number], string>> & {
    check_size_min?: number;
    check_size_max?: number;
  } = {};
  const filled: FillableField[] = [];

  for (const field of FILLABLE_FIELDS) {
    const next = incoming[field];
    if (isEmpty(existing[field]) && !isEmpty(next)) {
      patch[field] = next as string;
      filled.push(field);
    }
  }

  const hasCheck = existing.check_size_min !== null || existing.check_size_max !== null;
  if (!hasCheck && (incoming.check_size_min !== null || incoming.check_size_max !== null)) {
    if (incoming.check_size_min !== null) patch.check_size_min = incoming.check_size_min;
    if (incoming.check_size_max !== null) patch.check_size_max = incoming.check_size_max;
    filled.push("check_size");
  }

  return { patch, filled };
}

/** Which fields a parsed row carries, for the "what was saved" counts. */
export function presentFields(data: ParsedData): FillableField[] {
  const out: FillableField[] = [];
  for (const field of FILLABLE_FIELDS) {
    if (!isEmpty(data[field])) out.push(field);
  }
  if (data.check_size_min !== null || data.check_size_max !== null) out.push("check_size");
  return out;
}
