// Human-facing finding codes (F-001, F-002, …). Pure + unit-tested.

/** Next sequential finding code given the codes already in use. */
export function nextFindingCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const m = /^F-(\d+)$/.exec(code.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `F-${String(max + 1).padStart(3, "0")}`;
}

/** A short report code for a new engagement, e.g. DD-NORTHWIND-A3F2. */
export function generateReportCode(companyName: string): string {
  const slug = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10) || "ENGAGE";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DD-${slug}-${rand}`;
}

/** URL-safe unique slug from a company name. */
export function companySlug(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "engagement";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
