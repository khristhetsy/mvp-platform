// Prospect Pipeline — Step 3: verify + append cascade worker and stats.
// Cheapest-source-first per contact: (1) verify given email, (2) scrape company
// site, (3) infer from pattern (marked risky, must verify before send),
// (4) paid provider only if still missing. Bounded per batch to avoid timeouts.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { verifyEmail, type EmailStatus } from "./email";
import { scrapeSiteContacts } from "@/lib/append/site";
import { inferEmails, domainFromEmail } from "@/lib/append/pattern";
import { searchConfigured, searchCompanyContacts } from "@/lib/append/websearch";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_domain: string | null;
  email_status: string | null;
};

const MAX_SITE_SCRAPES = 10; // cap slow network work per batch

export interface VerifyBatchResult {
  processed: number;
  verified: number;
  appended: number;
  valid: number;
  risky: number;
  invalid: number;
  remaining: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function remainingUnverified(db: DB): Promise<number> {
  const { count } = await db
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .or("email_status.eq.unverified,email.is.null");
  return count ?? 0;
}

/** Run one verify + append batch over the next `limit` unverified contacts. */
export async function verifyBatch(limit = 40): Promise<VerifyBatchResult> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, phone, company, company_domain, email_status")
    .or("email_status.eq.unverified,email.is.null")
    .limit(limit);
  return processRows(db, (data ?? []) as Row[]);
}

/** Verify + append a specific set of contacts (a slice the user picked). */
export async function verifyByIds(ids: string[]): Promise<VerifyBatchResult> {
  const db = serviceRoleClientUntyped();
  const capped = ids.slice(0, 100); // bounded to fit the serverless window
  if (capped.length === 0) return { processed: 0, verified: 0, appended: 0, valid: 0, risky: 0, invalid: 0, remaining: await remainingUnverified(db) };
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, phone, company, company_domain, email_status")
    .in("id", capped);
  return processRows(db, (data ?? []) as Row[]);
}

async function processRows(db: DB, rows: Row[]): Promise<VerifyBatchResult> {
  const tally = { verified: 0, appended: 0, valid: 0, risky: 0, invalid: 0 };
  let scrapes = 0;
  const now = new Date().toISOString();

  for (const r of rows) {
    let status: EmailStatus = "unverified";
    let emailSource: string | null = null;
    let confidence = 0;
    let newEmail: string | null = null;
    let newPhone: string | null = null;
    let phoneSource: string | null = null;

    // (1) verify a given email
    if (r.email) {
      const v = await verifyEmail(r.email);
      status = v.status;
      emailSource = "given";
      confidence = v.confidence;
      tally.verified++;
    }

    const needsEmail = !r.email || status === "invalid";
    const needsPhone = !r.phone;
    // Use the stored company domain, else derive it from a business email.
    const domain = r.company_domain || domainFromEmail(r.email);

    if ((needsEmail || needsPhone) && (domain || r.company) && scrapes < MAX_SITE_SCRAPES) {
      scrapes++;
      // (2) scrape the company site (from the stored or email-derived domain)
      if (domain) {
        const site = await scrapeSiteContacts(domain);
        if (needsEmail && site.emails[0]) { newEmail = site.emails[0]; emailSource = "site"; }
        if (needsPhone && site.phones[0]) { newPhone = site.phones[0]; phoneSource = "site"; }
      }

      // (3) pattern inference → verify (kept risky: must be verified before send)
      if (needsEmail && !newEmail && r.name && domain) {
        for (const cand of inferEmails(r.name, domain)) {
          const v = await verifyEmail(cand);
          if (v.mx) { newEmail = cand; emailSource = "profile"; break; }
        }
      }

      // (4) internet search → company's own contact pages (last resort)
      if (((needsEmail && !newEmail) || (needsPhone && !newPhone)) && searchConfigured()) {
        const web = await searchCompanyContacts({ name: r.name, company: r.company, domain });
        // web results are extracted from the company's own site → store as "site"
        if (needsEmail && !newEmail && web.email) { newEmail = web.email; emailSource = "site"; }
        if (needsPhone && !newPhone && web.phone) { newPhone = web.phone; phoneSource = "site"; }
      }

      if (newEmail) {
        const v = await verifyEmail(newEmail);
        // inferred addresses stay risky until a provider confirms them
        status = emailSource === "profile" ? "risky" : v.status;
        confidence = emailSource === "profile" ? 40 : v.confidence;
        tally.appended++;
      }
    }

    if (status === "valid") tally.valid++;
    else if (status === "risky") tally.risky++;
    else if (status === "invalid") tally.invalid++;

    const patch: Record<string, unknown> = {
      updated_at: now,
      email_status: status,
      email_source: emailSource,
      contact_confidence: confidence,
      enrichment_status: domain || newEmail ? "enriched" : "no_website",
    };
    if (newEmail && !r.email) patch.email = newEmail;
    if (newPhone && newPhone !== r.phone) { patch.phone = newPhone; patch.phone_source = phoneSource; }

    // Surface write failures instead of dropping them silently (a bad column or
    // constraint would otherwise make verification look like a no-op).
    const { error: upErr } = await db.from("crm_contacts").update(patch).eq("id", r.id);
    if (upErr) throw new Error(`Failed to persist verification for ${r.id}: ${upErr.message}`);
  }

  const { count: remaining } = await db
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .or("email_status.eq.unverified,email.is.null");

  return { processed: rows.length, ...tally, remaining: remaining ?? 0 };
}

export interface VerifyStats {
  valid: number;
  risky: number;
  invalid: number;
  unverified: number;
}

export async function getVerifyStats(): Promise<VerifyStats> {
  const db = serviceRoleClientUntyped();
  const [{ count: valid }, { count: risky }, { count: invalid }, { count: unverified }] = await Promise.all([
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("email_status", "valid"),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("email_status", "risky"),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("email_status", "invalid"),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("email_status", "unverified"),
  ]);
  return { valid: valid ?? 0, risky: risky ?? 0, invalid: invalid ?? 0, unverified: unverified ?? 0 };
}
