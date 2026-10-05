// Prospect Pipeline — AI find-missing (suggest-only).
// Runs the compliant append cascade and returns candidate values WITHOUT writing
// them. The human reviews each suggestion and clicks Accept (acceptSuggestion)
// or Reject (no-op). Sources stay honest: company website + its own pages via
// search, then a pattern guess. No open-web PII scraping, no LinkedIn.
//
// Rules from docs/contact-finder-spec.md:
// - D4: a company inbox (info@, contact@ …) is never suggested as a person's email.
//   A scraped address is only suggested when it carries the person's name.
// - D5: phones found on a company site are company lines, never "confident".
// - D2: the MX check runs once per domain; the pattern guess is the top-ranked
//   format, with the next formats offered as alternatives.
// - D6: opted-out contacts are not looked up.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { verifyEmail, domainHasMx, isRoleAddress } from "./email";
import { isSuppressed, SUPPRESSED_REASON } from "./suppression";
import { scrapeSiteContacts } from "@/lib/append/site";
import { emailCandidates, domainFromEmail, nameTokens } from "@/lib/append/pattern";
import { searchConfigured, searchCompanyContacts } from "@/lib/append/websearch";
import { emailBelongsTo } from "@/lib/contacts/linkedin-import";

export interface Suggestion {
  field: "email" | "phone";
  value: string;
  source: "site" | "email" | "profile" | "web";
  /** true = found on the company's own pages AND carries the person's name, domain accepts mail. */
  confident: boolean;
  note: string;
  /** Pattern guesses only: the next most likely formats, best first. */
  alternatives?: string[];
}

const SOURCE_LABEL: Record<Suggestion["source"], string> = {
  site: "Company website",
  email: "Company website (from email)",
  profile: "Email pattern (unverified)",
  web: "Internet search → company site",
};

const COMPANY_LINE_NOTE = "Company line, not a direct number";

// email_source column only allows given/site/profile/provider — map UI sources.
function dbEmailSource(source: Suggestion["source"]): string {
  return source === "profile" ? "profile" : "site";
}

/** First and last word of a display name, for matching an address to a person. */
export function splitName(name: string | null): { first: string | null; last: string | null } {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: null, last: null };
  return { first: words[0], last: words.length > 1 ? words[words.length - 1] : null };
}

/**
 * The first address in `emails` that belongs to this person, never a company
 * inbox. Strict on purpose: the local part must be one of this person's name
 * formats (jane.doe, jdoe, jane …) or contain both first and last name. A bare
 * surname hit is not enough, so a colleague's marie.martin@ is not taken as
 * Martin Dupont's address.
 */
export function personalEmailFor(emails: string[], name: string | null): string | null {
  const { first, last } = splitName(name);
  if (!first && !last) return null;
  const formats = new Set(emailCandidates(name, "x.invalid").map((c) => c.email.split("@")[0]));
  const { firsts, lasts } = nameTokens(name);
  return emails.find((e) => {
    if (isRoleAddress(e) || !emailBelongsTo(e, first, last)) return false;
    const local = (e.split("@")[0] ?? "").toLowerCase();
    if (formats.has(local)) return true;
    const flat = local.replace(/[^a-z]/g, "");
    return firsts.some((f) => flat.includes(f.replace(/-/g, ""))) && lasts.some((l) => flat.includes(l.replace(/-/g, "")));
  }) ?? null;
}

/**
 * Suggest missing email/phone for one contact using the compliant cascade.
 * Returns candidates only — nothing is written to the database.
 */
export async function suggestForContact(contactId: string): Promise<{ suggestions: Suggestion[]; reason?: string }> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, phone, company, company_domain, email_status, suppressed")
    .eq("id", contactId)
    .maybeSingle();

  if (!data) return { suggestions: [], reason: "Contact not found." };
  const r = data as { name: string | null; email: string | null; phone: string | null; company: string | null; company_domain: string | null; email_status: string | null; suppressed: boolean | null };

  if (await isSuppressed(db, r)) return { suggestions: [], reason: SUPPRESSED_REASON };

  const needsEmail = !r.email || r.email_status === "invalid";
  const needsPhone = !r.phone;
  if (!needsEmail && !needsPhone) return { suggestions: [], reason: "Nothing missing — email and phone are already present." };

  // Prefer the stored company domain; otherwise derive it from a business email.
  const derivedFromEmail = !r.company_domain ? domainFromEmail(r.email) : null;
  const domain = r.company_domain || derivedFromEmail;
  // The site source is labelled differently when the domain came from the email.
  const siteSource: Suggestion["source"] = r.company_domain ? "site" : "email";

  if (!domain && !r.company) {
    return { suggestions: [], reason: "No company website on file, and the email is a personal address — nothing to search from." };
  }

  const out: Suggestion[] = [];
  let skippedCompanyInbox = false;

  // (1) Company website (stored domain, or the domain from a business email)
  if (domain) {
    const site = await scrapeSiteContacts(domain);
    if (needsEmail) {
      const mine = personalEmailFor(site.emails, r.name);
      if (mine) {
        const v = await verifyEmail(mine);
        out.push({ field: "email", value: mine, source: siteSource, confident: v.status === "valid", note: SOURCE_LABEL[siteSource] });
      } else if (site.emails.length > 0) {
        skippedCompanyInbox = true;
      }
    }
    if (needsPhone && site.phones[0]) {
      out.push({ field: "phone", value: site.phones[0], source: siteSource, confident: false, note: `${SOURCE_LABEL[siteSource]} · ${COMPANY_LINE_NOTE}` });
    }
  }

  // (2) Internet search → company's own contact/about/team pages.
  // Fills gaps the homepage missed, and finds the site when no domain is known.
  const stillNeedEmail = needsEmail && !out.some((s) => s.field === "email");
  const stillNeedPhone = needsPhone && !out.some((s) => s.field === "phone");
  let searchedDomain: string | null = domain;
  if ((stillNeedEmail || stillNeedPhone) && searchConfigured()) {
    const web = await searchCompanyContacts({ name: r.name, company: r.company, domain });
    searchedDomain = searchedDomain ?? web.domain;
    if (stillNeedEmail) {
      const pool = web.emails ?? (web.email ? [web.email] : []);
      const mine = personalEmailFor(pool, r.name);
      if (mine) {
        const v = await verifyEmail(mine);
        out.push({ field: "email", value: mine, source: "web", confident: v.status === "valid", note: SOURCE_LABEL.web });
      } else if (pool.length > 0) {
        skippedCompanyInbox = true;
      }
    }
    if (stillNeedPhone && web.phone) {
      out.push({ field: "phone", value: web.phone, source: "web", confident: false, note: `${SOURCE_LABEL.web} · ${COMPANY_LINE_NOTE}` });
    }
  }

  // (3) Email pattern guess — one MX check for the domain, then the top-ranked
  // format. Flagged risky; the next formats are offered as alternatives.
  const patternDomain = searchedDomain;
  if (needsEmail && !out.some((s) => s.field === "email") && r.name && patternDomain && (await domainHasMx(patternDomain))) {
    const cands = emailCandidates(r.name, patternDomain);
    if (cands.length > 0) {
      out.push({
        field: "email",
        value: cands[0].email,
        source: "profile",
        confident: false,
        note: `Pattern ${cands[0].format} (unverified)`,
        alternatives: cands.slice(1, 5).map((c) => c.email),
      });
    }
  }

  const inboxNote = skippedCompanyInbox ? " Only a company inbox was found, which is not used as a person's email." : "";
  const reason = out.length > 0 ? (skippedCompanyInbox ? inboxNote.trim() : undefined)
    : domain ? `No contact details for this person on the company's website.${inboxNote}`
    : searchConfigured() ? "Couldn't find the company's website."
    : "Personal email — no company website to derive. Add a search key (SERPER_API_KEY) to look the company up by name.";
  return { suggestions: out, reason };
}

/** Write an accepted suggestion to the contact. Pattern guesses land as "risky". */
export async function acceptSuggestion(input: { contactId: string; field: "email" | "phone"; value: string; source: Suggestion["source"] }): Promise<void> {
  const db = serviceRoleClientUntyped();
  const { data: current } = await db.from("crm_contacts").select("email, suppressed").eq("id", input.contactId).maybeSingle();
  if (!current) throw new Error("Contact not found.");
  if (await isSuppressed(db, current as { email: string | null; suppressed: boolean | null })) throw new Error(SUPPRESSED_REASON);
  // A found email that is itself on the unsubscribe list is never written either.
  if (input.field === "email" && (await isSuppressed(db, { email: input.value }))) throw new Error("That address opted out. Not saved.");
  // A company inbox is never saved as a person's email (spec D4), even by a direct API call.
  if (input.field === "email" && isRoleAddress(input.value)) throw new Error("That is a company inbox (info@, contact@ …), not this person's email. Not saved.");

  const patch: Record<string, unknown> = {};

  if (input.field === "email") {
    patch.email = input.value;
    patch.email_source = dbEmailSource(input.source);
    if (input.source === "profile") { patch.email_status = "risky"; patch.contact_confidence = 40; }
    else {
      const v = await verifyEmail(input.value);
      patch.email_status = v.status;
      patch.contact_confidence = v.confidence;
    }
    patch.enrichment_status = "enriched";
  } else {
    patch.phone = input.value;
    patch.phone_source = input.source; // phone_source has no CHECK constraint
  }

  const { error } = await db.from("crm_contacts").update(patch).eq("id", input.contactId);
  if (error) throw new Error(error.message);
}
