// Contact finder — retention and access requests (spec 5.5).
// Based on the issues France's CNIL cited against Kaspr (Dec 2024): a retention
// clock that restarted on every update, and vague answers to access requests.
// - found_at is set the FIRST time a finder value is accepted and never moved.
// - Expired, never-contacted contacts are listed for an admin to approve; the
//   clear removes only finder-sourced values and never deletes the contact.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const DEFAULT_RETENTION_MONTHS = 12;
export const LAWFUL_BASES = ["legitimate_interest", "consent", "existing_relationship"] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];
export const LAWFUL_BASIS_LABEL: Record<LawfulBasis, string> = {
  legitimate_interest: "Legitimate interest (B2B prospecting)",
  consent: "Consent",
  existing_relationship: "Existing relationship",
};

/** Lead statuses that mean the person has never been contacted. Sends auto-advance "new" → "contacted". */
export const NEVER_CONTACTED = [null, "new"] as const;

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

export async function getRetentionMonths(db: Db): Promise<number> {
  try {
    const { data } = await db.from("marketing_settings").select("finder_retention_months").eq("id", "default").maybeSingle();
    const n = Number(data?.finder_retention_months);
    return Number.isInteger(n) && n >= 1 && n <= 60 ? n : DEFAULT_RETENTION_MONTHS;
  } catch {
    return DEFAULT_RETENTION_MONTHS;
  }
}

export async function setRetentionMonths(db: Db, months: number): Promise<void> {
  if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error("Retention must be 1 to 60 months.");
  const { error } = await db.from("marketing_settings").upsert({ id: "default", finder_retention_months: months, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export interface Provenance { found_at: string | null; retention_expires_at: string | null; lawful_basis: string | null }

/**
 * Provenance patch for an accepted finder value.
 * - found_at and retention_expires_at are set the first time only, so later
 *   accepts, edits and settings changes never move the clock.
 * - lawful_basis is recorded when the contact has none; an existing basis
 *   (e.g. consent) is never overwritten by the page's default.
 */
export function provenancePatch(current: Provenance, months: number, lawfulBasis: LawfulBasis, nowIso = new Date().toISOString()): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (!current.lawful_basis) patch.lawful_basis = lawfulBasis;
  if (!current.found_at) {
    patch.found_at = nowIso;
    patch.retention_expires_at = addMonths(nowIso, months);
  } else if (!current.retention_expires_at) {
    patch.retention_expires_at = addMonths(current.found_at, months);
  }
  return patch;
}

/**
 * Read a contact's provenance. Returns null when the v2 columns don't exist yet
 * (migration not applied), so callers keep working and simply skip provenance.
 */
export async function readProvenance(db: Db, contactId: string): Promise<Provenance | null> {
  try {
    const { data, error } = await db.from("crm_contacts").select("found_at, retention_expires_at, lawful_basis").eq("id", contactId).maybeSingle();
    if (error || !data) return null;
    return data as Provenance;
  } catch {
    return null;
  }
}

export interface ExpiredContact {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  email_source: string | null;
  phone: string | null;
  phone_source: string | null;
  found_at: string | null;
  retention_expires_at: string;
  lead_status: string | null;
}

const EXPIRED_COLS = "id, name, company, email, email_source, phone, phone_source, found_at, retention_expires_at, lead_status";

/** Contacts past retention that were never contacted (lead_status null or "new"). */
export async function listExpired(db: Db, limit = 200, nowIso = new Date().toISOString()): Promise<{ rows: ExpiredContact[]; total: number }> {
  const { data, count, error } = await db
    .from("crm_contacts")
    .select(EXPIRED_COLS, { count: "exact" })
    .lt("retention_expires_at", nowIso)
    .or("lead_status.is.null,lead_status.eq.new")
    .order("retention_expires_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ExpiredContact[];
  const kept = await withoutUsedEmails(db, rows);
  return { rows: kept, total: Math.max(0, (count ?? 0) - (rows.length - kept.length)) };
}

/** True when a value was found (not given/imported). */
export const isFoundSource = (src: string | null | undefined): boolean => Boolean(src) && src !== "given";

/** The patch that clears only what the finder added. Given emails and phones stay. */
export function clearPatch(c: Pick<ExpiredContact, "email_source" | "phone_source">): Record<string, unknown> {
  const patch: Record<string, unknown> = { found_at: null, retention_expires_at: null };
  if (isFoundSource(c.email_source)) {
    Object.assign(patch, { email: null, email_status: "unverified", email_source: null, contact_confidence: null });
  }
  if (isFoundSource(c.phone_source)) Object.assign(patch, { phone: null, phone_source: null });
  return patch;
}

/**
 * Drop contacts whose found email was ever put on a marketing send list
 * (marketing_contacts is the mirror every bulk send path writes to). lead_status
 * alone isn't enough: only segment publishing advances it to "contacted".
 */
async function withoutUsedEmails(db: Db, rows: ExpiredContact[]): Promise<ExpiredContact[]> {
  const emails = [...new Set(rows.filter((r) => r.email && isFoundSource(r.email_source)).map((r) => (r.email as string).toLowerCase()))];
  if (emails.length === 0) return rows;
  const used = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const { data, error } = await db.from("marketing_contacts").select("email").in("email", emails.slice(i, i + 500));
    if (error) throw new Error(`Could not check send lists: ${error.message}`);
    for (const r of (data ?? []) as Array<{ email: string | null }>) if (r.email) used.add(r.email.toLowerCase());
  }
  return rows.filter((r) => !(r.email && isFoundSource(r.email_source) && used.has(r.email.toLowerCase())));
}

/** Clear finder-sourced values on the approved ids, re-checking expiry and contact status server side. */
export async function clearExpired(db: Db, ids: string[], nowIso = new Date().toISOString()): Promise<{ cleared: number; skipped: number }> {
  const capped = ids.slice(0, 500);
  if (capped.length === 0) return { cleared: 0, skipped: 0 };
  const { data, error } = await db
    .from("crm_contacts")
    .select(EXPIRED_COLS)
    .in("id", capped)
    .lt("retention_expires_at", nowIso)
    .or("lead_status.is.null,lead_status.eq.new");
  if (error) throw new Error(error.message);
  const rows = await withoutUsedEmails(db, (data ?? []) as ExpiredContact[]);
  for (const r of rows) {
    const { error: upErr } = await db.from("crm_contacts").update(clearPatch(r)).eq("id", r.id);
    if (upErr) throw new Error(`Failed to clear ${r.id}: ${upErr.message}`);
  }
  return { cleared: rows.length, skipped: capped.length - rows.length };
}

/** Everything held on one person and where it came from (access request). */
export async function exportContactData(db: Db, contactId: string): Promise<Record<string, unknown> | null> {
  const BASE = "id, name, email, email_status, email_source, phone, phone_source, company, company_domain, source, suppressed, lead_status, synced_at";
  let { data: contact, error } = await db.from("crm_contacts").select(`${BASE}, data_source_note, lawful_basis, found_at, retention_expires_at`).eq("id", contactId).maybeSingle();
  // Before the v2 migration the provenance columns don't exist: export what there is.
  if (error) ({ data: contact, error } = await db.from("crm_contacts").select(BASE).eq("id", contactId).maybeSingle());
  if (error) throw new Error(error.message);
  if (!contact) return null;
  const [{ data: lookups }, { data: suggestions }] = await Promise.all([
    db.from("contact_lookups").select("source, field, outcome, value, created_at").eq("contact_id", contactId).order("created_at"),
    db.from("contact_finder_suggestions").select("field, value, source, status, note, created_at, decided_at").eq("contact_id", contactId).order("created_at"),
  ]);
  return {
    exported_at: new Date().toISOString(),
    contact,
    lookup_history: lookups ?? [],
    suggestions: suggestions ?? [],
  };
}
