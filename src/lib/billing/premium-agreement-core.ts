/**
 * Founder Premium plan: the iCFO Services Agreement the founder accepts with a
 * check mark before paying (Nov 12, 2026). Pure helpers (no server imports) so
 * the checkout dialog, the routes and the tests share one definition.
 *
 * What the agreement says is decided by the Word master
 * (src/lib/contracts/masters/premium-services-agreement.ts): $1,000 a month as a
 * recurring subscription, month to month, no finder's fee, no signature blocks.
 * Bump AGREEMENT_VERSION whenever the master changes, so every acceptance is
 * tied to the exact text the founder agreed to.
 */

export const AGREEMENT_VERSION = "2026-11-premium-v3";
export const AGREEMENT_PLAN = "founder_premium" as const;

/**
 * iCFO's address for notices in Section 5.12. CONFIRM with Khris: this is the
 * only value in the agreement that was still a blank in the template.
 */
export const ICFO_NOTICE_EMAIL = "kthetsy@myicfos.com";

export type AgreementInput = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  acceptedName: string;
  acceptedTitle: string;
};

export type AgreementDefaults = Partial<AgreementInput>;

export type ParsedAgreementInput = { ok: true; value: AgreementInput } | { ok: false; error: string };

const MAX_LINE = 200;
const MAX_ADDRESS = 400;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** One line of text: trimmed, single spaced, and never able to carry a {{token}} into the Word file. */
function clean(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  const noTokens = value.replace(/\{\{|\}\}/g, "");
  const flat = multiline
    ? noTokens.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n")
    : noTokens.replace(/\s+/g, " ");
  return flat.trim().slice(0, max);
}

/** Validate the fields the founder fills in at checkout. Used by the preview, accept and download routes. */
export function parseAgreementInput(input: unknown): ParsedAgreementInput {
  if (!input || typeof input !== "object") return { ok: false, error: "Enter your company details." };
  const src = input as Record<string, unknown>;
  const value: AgreementInput = {
    companyName: clean(src.companyName, MAX_LINE),
    companyAddress: clean(src.companyAddress, MAX_ADDRESS, true),
    companyEmail: clean(src.companyEmail, MAX_LINE),
    acceptedName: clean(src.acceptedName, MAX_LINE),
    acceptedTitle: clean(src.acceptedTitle, MAX_LINE),
  };
  if (!value.companyName) return { ok: false, error: "Enter your company's legal name." };
  if (!value.companyAddress) return { ok: false, error: "Enter your company's address." };
  if (!EMAIL_RE.test(value.companyEmail)) return { ok: false, error: "Enter an email address for notices." };
  if (!value.acceptedName) return { ok: false, error: "Enter your name." };
  if (!value.acceptedTitle) return { ok: false, error: "Enter your title." };
  return { ok: true, value };
}

/** "November 12, 2026". Dates across iCapOS use Pacific time. */
export function agreementDatePT(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "long", day: "numeric" }).format(d);
}

/** Token values for the Word master. */
export function agreementValues(input: AgreementInput, acceptedAt: string | Date): Record<string, string> {
  return {
    accepted_date: agreementDatePT(acceptedAt),
    company_name: input.companyName,
    company_address: input.companyAddress,
    company_email: input.companyEmail,
    accepted_name: input.acceptedName,
    accepted_title: input.acceptedTitle,
    icfo_notice_email: ICFO_NOTICE_EMAIL,
  };
}

/** What the checkout dialog shows next to the agreement. Mirrors the master; the test checks both. */
export const AGREEMENT_TERMS: Array<{ label: string; value: string }> = [
  { label: "Billing", value: "$1,000 monthly subscription" },
  { label: "Term", value: "Month to month" },
  { label: "Cancel", value: "5 days written notice" },
  { label: "Commission or finder fee", value: "None" },
];
