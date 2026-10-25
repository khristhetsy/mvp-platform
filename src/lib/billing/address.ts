export type BillingAddress = {
  company: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId: string;
};

const MAX = 200;
const REQUIRED: Array<keyof BillingAddress> = ["company", "line1", "city", "postalCode", "country"];

export type ParsedAddress = { ok: true; value: BillingAddress } | { ok: false; error: string };

/** Validate a billing address from a request body. Trims every field. */
export function parseBillingAddress(input: unknown): ParsedAddress {
  if (!input || typeof input !== "object") return { ok: false, error: "Enter a billing address." };
  const src = input as Record<string, unknown>;
  const read = (k: keyof BillingAddress) => (typeof src[k] === "string" ? (src[k] as string).trim() : "");
  const value: BillingAddress = {
    company: read("company"),
    line1: read("line1"),
    line2: read("line2"),
    city: read("city"),
    state: read("state"),
    postalCode: read("postalCode"),
    country: read("country"),
    taxId: read("taxId"),
  };
  for (const k of REQUIRED) {
    if (!value[k]) return { ok: false, error: "Enter your company name, street address, city, postal code, and country." };
  }
  for (const k of Object.keys(value) as Array<keyof BillingAddress>) {
    if (value[k].length > MAX) return { ok: false, error: "One of the fields is too long." };
  }
  return { ok: true, value };
}

/** Lines for an invoice "Bill to" block. */
export function addressLines(a: Partial<BillingAddress> | null | undefined): string[] {
  if (!a) return [];
  const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.line1, a.line2, cityLine, a.country, a.taxId ? `Tax ID: ${a.taxId}` : ""].filter((s): s is string => Boolean(s && s.trim()));
}

/** Read a stored address back from the database, ignoring anything malformed. */
export function readStoredAddress(raw: unknown): BillingAddress | null {
  const parsed = parseBillingAddress(raw);
  return parsed.ok ? parsed.value : null;
}
