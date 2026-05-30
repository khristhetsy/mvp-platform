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
    notes: string | null;
  } | null;
};

function parseCheckSize(value: string | undefined) {
  if (!value?.trim()) {
    return { min: null, max: null };
  }

  const cleaned = value.replace(/[$,\s]/g, "").toLowerCase();
  const multiplier = cleaned.includes("m") ? 1_000_000 : cleaned.includes("k") ? 1_000 : 1;
  const numbers = cleaned.match(/[\d.]+/g)?.map((n) => Number(n) * multiplier) ?? [];

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
