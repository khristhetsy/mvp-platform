// Form D Desk — Investor Mode · §6 Principal identity.
// Related-person street addresses are parsed but NEVER persisted. The natural
// dedupe key needs the address, so we compute a keyed HMAC in memory and discard
// the plaintext. Firm-scoped fallback when there's no street, so one person
// across five vehicles collapses while two same-named people at different funds
// stay separate. Rotating PRINCIPAL_HASH_KEY invalidates every row (runbook: full
// rebuild — acceptance test 6 asserts same count, different hashes).

import crypto from "node:crypto";

export type PrincipalIdentityInput = {
  firstName: string;
  lastName: string;
  street1?: string | null;
  postalCode?: string | null;
  firmId: string; // used only in the address-less fallback
};

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Keyed identity hash. With a street, keys on name+street+postal; without one,
 *  falls back to name+firm_id (firm-scoped). Plaintext is never stored. */
export function principalIdentityHash(input: PrincipalIdentityInput, key: string): string {
  if (!key) throw new Error("PRINCIPAL_HASH_KEY is required.");
  const hasStreet = Boolean(input.street1 && input.street1.trim());
  const base = hasStreet
    ? `${lc(input.firstName)}|${lc(input.lastName)}|${lc(input.street1)}|${lc(input.postalCode)}`
    : `${lc(input.firstName)}|${lc(input.lastName)}|${input.firmId}`;
  return crypto.createHmac("sha256", key).update(base).digest("hex");
}
