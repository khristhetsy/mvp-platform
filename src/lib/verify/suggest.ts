// Prospect Pipeline — AI find-missing (suggest-only).
// Runs the compliant append cascade and returns candidate values WITHOUT writing
// them to the contact. The human reviews each suggestion and clicks Accept
// (acceptSuggestion) or Reject (rejectSuggestion). Sources stay honest: company
// website + its own pages via search, then a format guess. No open-web PII
// scraping, no LinkedIn.
//
// Rules from docs/contact-finder-spec.md:
// - D4: a company inbox (info@, contact@ …) is never suggested as a person's email.
//   A scraped address is only suggested when it carries the person's name.
// - D5: phones found on a company site are company lines, never "confident".
// - D2 + 5.2: one MX check per domain; the guess uses the company's learned
//   format when there is one, else the global ranking, with the next formats as
//   alternatives.
// - D6: opted-out contacts are not looked up.
// - 5.1/5.3: every source attempt is logged (contact_lookups) and suggestions are
//   persisted (contact_finder_suggestions), so a rejected value never comes back.
// - 5.5: accepting records the lawful basis and starts the retention clock once.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { verifyEmail, domainHasMx, isRoleAddress } from "./email";
import { isSuppressed, SUPPRESSED_REASON } from "./suppression";
import { logLookups, type LookupRow, type LookupSource } from "./lookups";
import { getRetentionMonths, provenancePatch, readProvenance, LAWFUL_BASES, type LawfulBasis } from "./retention";
import { scrapeSiteContacts, normalizePhone } from "@/lib/append/site";
import { emailCandidates, domainFromEmail, nameTokens } from "@/lib/append/pattern";
import { formatOrderFor, recordKnownEmail } from "@/lib/append/domain-patterns";
import { searchConfigured, searchCompanyContacts } from "@/lib/append/websearch";
import { emailBelongsTo } from "@/lib/contacts/linkedin-import";

export interface Suggestion {
  /** contact_finder_suggestions.id once persisted. */
  id?: string;
  field: "email" | "phone";
  value: string;
  source: "site" | "email" | "profile" | "web";
  /** true = found on the company's own pages AND carries the person's name, domain accepts mail. */
  confident: boolean;
  note: string;
  /** Format guesses only: the next most likely formats, best first. */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Values already accepted or rejected for this contact ("field|value"). Empty if the table is missing. */
async function decidedValues(db: Db, contactId: string): Promise<Set<string>> {
  try {
    const { data, error } = await db.from("contact_finder_suggestions").select("field, value, status").eq("contact_id", contactId).neq("status", "pending");
    if (error) return new Set();
    return new Set(((data ?? []) as Array<{ field: string; value: string }>).map((r) => `${r.field}|${r.value}`));
  } catch {
    return new Set();
  }
}

/**
 * Save new suggestions as pending, skip any value already accepted or rejected,
 * and return the contact's pending suggestions with their ids.
 */
async function persistSuggestions(db: Db, contactId: string, found: Suggestion[]): Promise<Suggestion[]> {
  try {
    const decided = await decidedValues(db, contactId);
    const fresh = found.filter((s) => !decided.has(`${s.field}|${s.value}`));
    if (fresh.length > 0) {
      await db.from("contact_finder_suggestions").upsert(
        fresh.map((s) => ({ contact_id: contactId, field: s.field, value: s.value, source: s.source, confident: s.confident, note: s.note, alternatives: s.alternatives ?? [] })),
        { onConflict: "contact_id,field,value", ignoreDuplicates: true },
      );
    }
    return await loadPendingSuggestions(db, [contactId]).then((m) => m[contactId] ?? []);
  } catch {
    // Persisting is for review across reloads; if it fails, still show what was found.
    return found;
  }
}

/** Pending suggestions for these contacts, keyed by contact id. */
export async function loadPendingSuggestions(db: Db, contactIds: string[]): Promise<Record<string, Suggestion[]>> {
  const out: Record<string, Suggestion[]> = {};
  if (contactIds.length === 0) return out;
  const { data, error } = await db
    .from("contact_finder_suggestions")
    .select("id, contact_id, field, value, source, confident, note, alternatives")
    .in("contact_id", contactIds.slice(0, 500))
    .eq("status", "pending")
    .order("created_at");
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as Array<Suggestion & { contact_id: string; alternatives: string[] | null }>) {
    (out[r.contact_id] ??= []).push({ id: r.id, field: r.field, value: r.value, source: r.source, confident: r.confident, note: r.note ?? "", alternatives: r.alternatives?.length ? r.alternatives : undefined });
  }
  return out;
}

/**
 * Suggest missing email/phone for one contact using the compliant cascade.
 * Writes only to the lookup log and the suggestions table, never to the contact.
 */
export async function suggestForContact(contactId: string, runBy: string | null = null): Promise<{ suggestions: Suggestion[]; reason?: string }> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, phone, company, company_domain, email_status, suppressed")
    .eq("id", contactId)
    .maybeSingle();

  if (!data) return { suggestions: [], reason: "Contact not found." };
  const r = data as { name: string | null; email: string | null; phone: string | null; company: string | null; company_domain: string | null; email_status: string | null; suppressed: boolean | null };

  const needsEmail = !r.email || r.email_status === "invalid";
  const needsPhone = !r.phone;
  const log: LookupRow[] = [];
  const note = (source: LookupSource, field: "email" | "phone", outcome: LookupRow["outcome"], value?: string | null) =>
    log.push({ contact_id: contactId, source, field, outcome, value: value ?? null, run_by: runBy });

  if (await isSuppressed(db, r)) {
    if (needsEmail) note("site", "email", "skipped_suppressed");
    await logLookups(db, log);
    return { suggestions: [], reason: SUPPRESSED_REASON };
  }
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
        note("site", "email", "found", mine);
      } else {
        if (site.emails.length > 0) skippedCompanyInbox = true;
        note("site", "email", "not_found");
      }
    }
    if (needsPhone) {
      if (site.phones[0]) {
        out.push({ field: "phone", value: site.phones[0], source: siteSource, confident: false, note: `${SOURCE_LABEL[siteSource]} · ${COMPANY_LINE_NOTE}` });
        note("site", "phone", "found", site.phones[0]);
      } else note("site", "phone", "not_found");
    }
  }

  // (2) Internet search → company's own contact/about/team pages.
  // Fills gaps the homepage missed, and finds the site when no domain is known.
  const stillNeedEmail = needsEmail && !out.some((s) => s.field === "email");
  const stillNeedPhone = needsPhone && !out.some((s) => s.field === "phone");
  let searchedDomain: string | null = domain;
  if (stillNeedEmail || stillNeedPhone) {
    if (searchConfigured()) {
      const web = await searchCompanyContacts({ name: r.name, company: r.company, domain });
      searchedDomain = searchedDomain ?? web.domain;
      if (stillNeedEmail) {
        const pool = web.emails ?? (web.email ? [web.email] : []);
        const mine = personalEmailFor(pool, r.name);
        if (mine) {
          const v = await verifyEmail(mine);
          out.push({ field: "email", value: mine, source: "web", confident: v.status === "valid", note: SOURCE_LABEL.web });
          note("web", "email", "found", mine);
        } else {
          if (pool.length > 0) skippedCompanyInbox = true;
          note("web", "email", "not_found");
        }
      }
      if (stillNeedPhone) {
        if (web.phone) {
          out.push({ field: "phone", value: web.phone, source: "web", confident: false, note: `${SOURCE_LABEL.web} · ${COMPANY_LINE_NOTE}` });
          note("web", "phone", "found", web.phone);
        } else note("web", "phone", "not_found");
      }
    }
  }

  // (3) Format guess — one MX check for the domain, then the company's learned
  // format (or the global ranking). Flagged risky; next formats as alternatives.
  const patternDomain = searchedDomain;
  if (needsEmail && !out.some((s) => s.field === "email") && r.name && patternDomain) {
    if (await domainHasMx(patternDomain)) {
      const { order, learned } = await formatOrderFor(db, patternDomain);
      // A format someone already rejected for this person is skipped, so the next one is offered.
      const decided = await decidedValues(db, contactId);
      const cands = emailCandidates(r.name, patternDomain, order).filter((c) => !decided.has(`email|${c.email}`));
      const source: LookupSource = learned ? "domain_pattern" : "pattern";
      if (cands.length > 0) {
        out.push({
          field: "email",
          value: cands[0].email,
          source: "profile",
          confident: false,
          note: learned
            ? `Company format ${cands[0].format}, learned from ${learned.verified_samples} known emails (unverified)`
            : `Pattern ${cands[0].format} (unverified)`,
          alternatives: cands.slice(1, 5).map((c) => c.email),
        });
        note(source, "email", "found", cands[0].email);
      } else note(source, "email", "not_found");
    } else note("pattern", "email", "not_found");
  }

  await logLookups(db, log);
  const suggestions = await persistSuggestions(db, contactId, out);

  const inboxNote = skippedCompanyInbox ? " Only a company inbox was found, which is not used as a person's email." : "";
  const reason = suggestions.length > 0 ? (skippedCompanyInbox ? inboxNote.trim() : undefined)
    : out.length > 0 ? "Everything found was already reviewed."
    : domain ? `No contact details for this person on the company's website.${inboxNote}`
    : searchConfigured() ? "Couldn't find the company's website."
    : "Personal email — no company website to derive. Add a search key (SERPER_API_KEY) to look the company up by name.";
  return { suggestions, reason };
}

export interface AcceptInput {
  contactId: string;
  field: "email" | "phone";
  value: string;
  source: Suggestion["source"];
  lawfulBasis: LawfulBasis;
  /** The suggestion row being accepted (an alternative format accepts the same row). */
  suggestionId?: string;
  runBy?: string | null;
}

/** Write an accepted suggestion to the contact. Pattern guesses land as "risky". */
export async function acceptSuggestion(input: AcceptInput): Promise<void> {
  if (!(LAWFUL_BASES as readonly string[]).includes(input.lawfulBasis)) throw new Error("Pick a lawful basis before saving.");
  const db = serviceRoleClientUntyped();
  const { data: current } = await db.from("crm_contacts").select("email, name, suppressed").eq("id", input.contactId).maybeSingle();
  if (!current) throw new Error("Contact not found.");
  if (await isSuppressed(db, current as { email: string | null; suppressed: boolean | null })) throw new Error(SUPPRESSED_REASON);
  // A found email that is itself on the unsubscribe list is never written either.
  if (input.field === "email" && (await isSuppressed(db, { email: input.value }))) throw new Error("That address opted out. Not saved.");
  // A company inbox is never saved as a person's email (spec D4), even by a direct API call.
  if (input.field === "email" && isRoleAddress(input.value)) throw new Error("That is a company inbox (info@, contact@ …), not this person's email. Not saved.");

  // Provenance needs the v2 columns; before that migration the accept still works without it.
  const prov = await readProvenance(db, input.contactId);
  const patch: Record<string, unknown> = prov ? provenancePatch(prov, await getRetentionMonths(db), input.lawfulBasis) : {};

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
    patch.phone = normalizePhone(input.value, { fromTelLink: true }) ?? input.value;
    patch.phone_source = input.source; // phone_source has no CHECK constraint
  }

  const { error } = await db.from("crm_contacts").update(patch).eq("id", input.contactId);
  if (error) throw new Error(error.message);

  await recordDecision(db, input);

  // A real address found under the person's name on their company site teaches
  // the company's format. Guesses never do.
  if (input.field === "email" && input.source !== "profile") {
    await recordKnownEmail(db, input.value, (current as { name: string | null }).name);
  }
}

/**
 * Record the accept in the review log. When the person picked an alternative
 * format, the saved value differs from the stored suggestion: log the value that
 * was actually saved as accepted, and the original guess as rejected.
 */
async function recordDecision(db: Db, input: AcceptInput): Promise<void> {
  const runBy = input.runBy ?? null;
  try {
    if (input.suggestionId) {
      const { data } = await db.from("contact_finder_suggestions").select("value").eq("id", input.suggestionId).maybeSingle();
      const stored = (data as { value: string } | null)?.value;
      if (stored && stored !== input.value) {
        await markDecided(db, input.contactId, input.field, { id: input.suggestionId }, "rejected", runBy, false);
        await db.from("contact_finder_suggestions").upsert(
          { contact_id: input.contactId, field: input.field, value: input.value, source: input.source, confident: false, note: "Alternative format chosen", status: "pending" },
          { onConflict: "contact_id,field,value", ignoreDuplicates: true },
        );
        await markDecided(db, input.contactId, input.field, { value: input.value }, "accepted", runBy);
        return;
      }
    }
    await markDecided(db, input.contactId, input.field, input.suggestionId ? { id: input.suggestionId } : { value: input.value }, "accepted", runBy);
  } catch {
    /* the contact write already happened; the review log is best effort */
  }
}

/** Mark one suggestion decided; when one is accepted, other pending ones for that field are closed too. */
async function markDecided(db: Db, contactId: string, field: "email" | "phone", which: { id: string } | { value: string }, status: "accepted" | "rejected", runBy: string | null, closeOthers = true): Promise<void> {
  try {
    const stamp = { status, decided_by: runBy, decided_at: new Date().toISOString() };
    let q = db.from("contact_finder_suggestions").update(stamp).eq("contact_id", contactId).eq("field", field).eq("status", "pending");
    q = "id" in which ? q.eq("id", which.id) : q.eq("value", which.value);
    await q;
    if (status === "accepted" && closeOthers) {
      await db.from("contact_finder_suggestions").update({ ...stamp, status: "rejected" }).eq("contact_id", contactId).eq("field", field).eq("status", "pending");
    }
  } catch {
    /* the contact write already happened; the review log is best effort */
  }
}

/** Reject a suggestion so it is not offered again. */
export async function rejectSuggestion(input: { contactId: string; field: "email" | "phone"; suggestionId?: string; value?: string; runBy?: string | null }): Promise<void> {
  const db = serviceRoleClientUntyped();
  if (!input.suggestionId && !input.value) throw new Error("Nothing to reject.");
  await markDecided(db, input.contactId, input.field, input.suggestionId ? { id: input.suggestionId } : { value: input.value as string }, "rejected", input.runBy ?? null);
}

export const MANUAL_SOURCES = ["manual_kaspr", "manual_apollo", "manual_other"] as const;
export type ManualSource = (typeof MANUAL_SOURCES)[number];

/**
 * Log a value someone revealed by hand in Kaspr, Apollo or elsewhere (spec 5.7).
 * The person is the reviewer here, so it is written straight to the contact,
 * with the same opt-out, company-inbox and lawful-basis rules as an accept.
 */
export async function logManualReveal(input: { contactId: string; email?: string | null; phone?: string | null; source: ManualSource; lawfulBasis: LawfulBasis; runBy?: string | null }): Promise<{ email: string | null; phone: string | null }> {
  if (!(MANUAL_SOURCES as readonly string[]).includes(input.source)) throw new Error("Unknown source.");
  if (!(LAWFUL_BASES as readonly string[]).includes(input.lawfulBasis)) throw new Error("Pick a lawful basis before saving.");
  const email = (input.email ?? "").trim().toLowerCase() || null;
  const phoneRaw = (input.phone ?? "").trim() || null;
  if (!email && !phoneRaw) throw new Error("Enter an email or a phone.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email isn't valid.");
  const phone = phoneRaw ? normalizePhone(phoneRaw, { fromTelLink: true }) : null;
  if (phoneRaw && !phone) throw new Error("That phone number isn't valid.");

  const db = serviceRoleClientUntyped();
  const { data: current } = await db.from("crm_contacts").select("email, name, suppressed").eq("id", input.contactId).maybeSingle();
  if (!current) throw new Error("Contact not found.");
  if (await isSuppressed(db, current as { email: string | null; suppressed: boolean | null })) throw new Error(SUPPRESSED_REASON);
  if (email && (await isSuppressed(db, { email }))) throw new Error("That address opted out. Not saved.");
  if (email && isRoleAddress(email)) throw new Error("That is a company inbox (info@, contact@ …), not this person's email. Not saved.");

  const prov = await readProvenance(db, input.contactId);
  const patch: Record<string, unknown> = prov ? provenancePatch(prov, await getRetentionMonths(db), input.lawfulBasis) : {};
  if (email) {
    const v = await verifyEmail(email);
    Object.assign(patch, { email, email_source: "provider", email_status: v.status, contact_confidence: v.confidence, enrichment_status: "enriched" });
  }
  if (phone) Object.assign(patch, { phone, phone_source: input.source });

  const { error } = await db.from("crm_contacts").update(patch).eq("id", input.contactId);
  if (error) throw new Error(error.message);

  const log: LookupRow[] = [];
  if (email) log.push({ contact_id: input.contactId, source: input.source, field: "email", outcome: "found", value: email, run_by: input.runBy ?? null });
  if (phone) log.push({ contact_id: input.contactId, source: input.source, field: "phone", outcome: "found", value: phone, run_by: input.runBy ?? null });
  await logLookups(db, log);
  if (email) await recordKnownEmail(db, email, (current as { name: string | null }).name);
  return { email, phone };
}
