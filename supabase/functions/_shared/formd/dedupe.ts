// Form D dedupe helpers (build spec §9). Form D contacts have no email, so
// dedupe keys on CIK (amendments) and a normalized company-name + phone match.

/** lowercase, strip punctuation, strip entity suffixes, collapse whitespace. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"']/g, " ")
    .replace(/\b(inc|llc|lp|corp|corporation|ltd|limited|co|company|l\.?p\.?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits-only phone for loose matching. */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export type DedupeDecision =
  | { action: "update"; contactId: string } // same CIK — already promoted
  | { action: "possible_match"; contactId: string } // name+phone match — admin decides
  | { action: "create" };

/**
 * Decide how to promote a filing, given existing contacts.
 * 1) same CIK → update. 2) same normalized company+phone → possible match. 3) create.
 */
export function decidePromotion(
  filing: { cik: string; companyName: string; phone: string | null },
  existing: Array<{ id: string; formdCik: string | null; companyName: string | null; phone: string | null }>,
): DedupeDecision {
  const byCik = existing.find((c) => c.formdCik && c.formdCik === filing.cik);
  if (byCik) return { action: "update", contactId: byCik.id };

  const name = normalizeName(filing.companyName);
  const phone = normalizePhone(filing.phone);
  if (name && phone) {
    const match = existing.find((c) => normalizeName(c.companyName) === name && normalizePhone(c.phone) === phone);
    if (match) return { action: "possible_match", contactId: match.id };
  }
  return { action: "create" };
}
