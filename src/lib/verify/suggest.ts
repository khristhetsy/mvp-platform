// Prospect Pipeline — AI find-missing (suggest-only).
// Runs the SAME compliant append cascade as the verify worker, but returns
// candidate values WITHOUT writing them. The human reviews each suggestion and
// clicks Accept (which calls acceptSuggestion) or Reject (no-op). Sources stay
// honest: company website + licensed discovery provider only — no open-web PII
// scraping. Pattern-guessed addresses are surfaced but flagged "risky".

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { verifyEmail } from "./email";
import { scrapeSiteContacts } from "@/lib/append/site";
import { inferEmails, domainFromEmail } from "@/lib/append/pattern";
import { searchConfigured, searchCompanyContacts } from "@/lib/append/websearch";

export interface Suggestion {
  field: "email" | "phone";
  value: string;
  source: "site" | "email" | "profile" | "web";
  /** true = verified deliverable / found on company site; false = pattern guess, must verify before send */
  confident: boolean;
  note: string;
}

const SOURCE_LABEL: Record<Suggestion["source"], string> = {
  site: "Company website",
  email: "Company website (from email)",
  profile: "Email pattern (unverified)",
  web: "Internet search → company site",
};

// email_source column only allows given/site/profile/provider — map UI sources.
function dbEmailSource(source: Suggestion["source"]): string {
  return source === "profile" ? "profile" : "site";
}

/**
 * Suggest missing email/phone for one contact using the compliant cascade.
 * Returns candidates only — nothing is written to the database.
 */
export async function suggestForContact(contactId: string): Promise<{ suggestions: Suggestion[]; reason?: string }> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, phone, company, company_domain, email_status")
    .eq("id", contactId)
    .maybeSingle();

  if (!data) return { suggestions: [], reason: "Contact not found." };
  const r = data as { name: string | null; email: string | null; phone: string | null; company: string | null; company_domain: string | null; email_status: string | null };

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

  // (1) Company website (stored domain, or the domain from a business email)
  if (domain) {
    const site = await scrapeSiteContacts(domain);
    if (needsEmail && site.emails[0]) {
      const v = await verifyEmail(site.emails[0]);
      out.push({ field: "email", value: site.emails[0], source: siteSource, confident: v.status === "valid", note: SOURCE_LABEL[siteSource] });
    }
    if (needsPhone && site.phones[0]) {
      out.push({ field: "phone", value: site.phones[0], source: siteSource, confident: true, note: SOURCE_LABEL[siteSource] });
    }
  }

  // (2) Internet search → company's own contact/about/team pages.
  // Fills gaps the homepage missed, and finds the site when no domain is known.
  const stillNeedEmail = needsEmail && !out.some((s) => s.field === "email");
  const stillNeedPhone = needsPhone && !out.some((s) => s.field === "phone");
  if ((stillNeedEmail || stillNeedPhone) && searchConfigured()) {
    const web = await searchCompanyContacts({ name: r.name, company: r.company, domain });
    if (stillNeedEmail && web.email) {
      const v = await verifyEmail(web.email);
      out.push({ field: "email", value: web.email, source: "web", confident: v.status === "valid", note: SOURCE_LABEL.web });
    }
    if (stillNeedPhone && web.phone) {
      out.push({ field: "phone", value: web.phone, source: "web", confident: true, note: SOURCE_LABEL.web });
    }
  }

  // (3) Email pattern inference — surfaced but flagged risky (needs a domain).
  if (needsEmail && !out.some((s) => s.field === "email") && r.name && domain) {
    for (const cand of inferEmails(r.name, domain)) {
      const v = await verifyEmail(cand);
      if (v.mx) { out.push({ field: "email", value: cand, source: "profile", confident: false, note: SOURCE_LABEL.profile }); break; }
    }
  }

  const reason = out.length > 0 ? undefined
    : domain ? "No public contact details found on the company's website."
    : searchConfigured() ? "Couldn't find the company's website."
    : "Personal email — no company website to derive. Add a search key (SERPER_API_KEY) to look the company up by name.";
  return { suggestions: out, reason };
}

/** Write an accepted suggestion to the contact. Pattern guesses land as "risky". */
export async function acceptSuggestion(input: { contactId: string; field: "email" | "phone"; value: string; source: Suggestion["source"] }): Promise<void> {
  const db = serviceRoleClientUntyped();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

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
