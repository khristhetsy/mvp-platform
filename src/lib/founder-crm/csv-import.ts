import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";

export type CsvImportRow = {
  investor_name?: string;
  firm_name?: string;
  email?: string;
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
      return { ...row, duplicate: false, skipped: false };
    }

    const email = row.data.email;
    if (existingEmails.has(email) || seen.has(email)) {
      return { ...row, duplicate: true, skipped: true };
    }

    seen.add(email);
    return { ...row, duplicate: false, skipped: false };
  });
}
