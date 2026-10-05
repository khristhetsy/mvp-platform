// Prospect Pipeline — bulk verify worker and stats.
// The bulk run ONLY verifies emails contacts already have. It never writes a
// found email or phone: those come from "Find missing info", where a person
// reviews each suggestion before it is saved (AI drafts, humans confirm).
// Opted-out contacts are skipped. See docs/contact-finder-spec.md (D4, D5, D6).

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { verifyEmail, type EmailStatus } from "./email";
import { unsubscribedEmails } from "./suppression";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_domain: string | null;
  email_status: string | null;
  email_source: string | null;
  suppressed: boolean | null;
};

const ROW_COLS = "id, name, email, phone, company, company_domain, email_status, email_source, suppressed";

export interface VerifyBatchResult {
  processed: number;
  verified: number;
  /** Always 0 since the bulk run stopped appending. Kept for API compatibility. */
  appended: number;
  valid: number;
  risky: number;
  invalid: number;
  /** Selected contacts with no email: use "Find missing info" for these. */
  missingEmail: number;
  /** Selected contacts skipped because they opted out. */
  suppressed: number;
  remaining: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// The queue: contacts that HAVE an email which hasn't been checked yet, and
// haven't opted out. Contacts with no email are not in it (nothing to verify),
// so "Verify all" drains instead of re-reading the same rows.
function queue(q: DB): DB {
  return q.eq("email_status", "unverified").not("email", "is", null).neq("email", "").eq("suppressed", false);
}

async function remainingUnverified(db: DB): Promise<number> {
  const { count } = await queue(db.from("crm_contacts").select("id", { count: "exact", head: true }));
  return count ?? 0;
}

/** Verify the next `limit` contacts in the queue. */
export async function verifyBatch(limit = 40): Promise<VerifyBatchResult> {
  const db = serviceRoleClientUntyped();
  const { data } = await queue(db.from("crm_contacts").select(ROW_COLS)).order("id").limit(limit);
  return processRows(db, (data ?? []) as Row[]);
}

/** Verify a specific set of contacts (a slice the user picked). */
export async function verifyByIds(ids: string[]): Promise<VerifyBatchResult> {
  const db = serviceRoleClientUntyped();
  const capped = ids.slice(0, 100);
  if (capped.length === 0) {
    return { processed: 0, verified: 0, appended: 0, valid: 0, risky: 0, invalid: 0, missingEmail: 0, suppressed: 0, remaining: await remainingUnverified(db) };
  }
  const { data } = await db.from("crm_contacts").select(ROW_COLS).in("id", capped);
  return processRows(db, (data ?? []) as Row[]);
}

async function processRows(db: DB, rows: Row[]): Promise<VerifyBatchResult> {
  const tally = { verified: 0, valid: 0, risky: 0, invalid: 0, missingEmail: 0, suppressed: 0 };
  const unsubscribed = await unsubscribedEmails(db, rows.map((r) => r.email));

  for (const r of rows) {
    if (r.suppressed) { tally.suppressed++; continue; }
    if (r.email && unsubscribed.has(r.email.trim().toLowerCase())) {
      // They unsubscribed but the contact flag wasn't set: set it, so they leave
      // the queue (and every segment that checks suppressed) instead of blocking it.
      const { error } = await db.from("crm_contacts").update({ suppressed: true }).eq("id", r.id);
      if (error) throw new Error(`Failed to mark ${r.id} suppressed: ${error.message}`);
      tally.suppressed++;
      continue;
    }
    if (!r.email || !r.email.trim()) { tally.missingEmail++; continue; }

    const v = await verifyEmail(r.email);
    // A pattern guess stays "risky" until a mailbox check confirms it: a domain
    // that accepts mail says nothing about whether this guessed address exists.
    const isGuess = r.email_source === "profile";
    const status: EmailStatus = isGuess && v.status === "valid" && v.level !== "mailbox" ? "risky" : v.status;
    tally.verified++;
    if (status === "valid") tally.valid++;
    else if (status === "risky") tally.risky++;
    else if (status === "invalid") tally.invalid++;

    const { error: upErr } = await db
      .from("crm_contacts")
      // Keep where the address came from; only an unlabelled address becomes "given".
      .update({ email_status: status, email_source: r.email_source ?? "given", contact_confidence: isGuess ? Math.min(v.confidence, 40) : v.confidence })
      .eq("id", r.id);
    // Surface write failures instead of dropping them silently.
    if (upErr) throw new Error(`Failed to persist verification for ${r.id}: ${upErr.message}`);
  }

  return { processed: rows.length, appended: 0, ...tally, remaining: await remainingUnverified(db) };
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
