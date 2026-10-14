/**
 * Writes the "Founder log note" into a Contact's Note Log when a founder finishes the
 * /fit Match Review. One entry per /fit session, added automatically once the session
 * has BOTH an email and a match snapshot (whichever arrives second triggers it).
 *
 * Contact lookup is by email; a new Founder contact (lead source icapos.com/fit) is
 * created when none exists. Notes live in crm_contact_annotations.notes as one text
 * column, so the entry is appended with appendContactNote. Idempotent: the session id
 * is written into the entry and checked before appending.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { appendContactNote } from "@/lib/sales/contacts";
import type { MatchResult } from "@/lib/fit/match-investors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const LEAD_SOURCE = "icapos.com/fit";
export const FIT_TAG = "Fit match";

/** Pacific time, per the platform rule that every date and time uses PT. */
function ptStamp(d: Date): string {
  const s = d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
  return `${s.replace(",", "")} PT`;
}

async function findContactByEmail(email: string): Promise<string | null> {
  const { data } = await db().from("crm_contacts").select("id, source, module").ilike("email", email).limit(10);
  const rows: Array<{ id: string; source: string | null; module: string | null }> = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;
  // The same email can exist more than once (Odoo plus the record /fit created). Prefer the
  // /fit created record, then a Founder record, so the note never lands on a random duplicate.
  const rank = (r: { source: string | null; module: string | null }) => r.source === "fit" ? 0 : r.module === "founder" ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b));
  return String(rows[0].id);
}

async function findOrCreateContact(email: string): Promise<string | null> {
  const existing = await findContactByEmail(email);
  if (existing) return existing;
  const name = email.split("@")[0] || email;
  const { data, error } = await db()
    .from("crm_contacts")
    .insert({
      name,
      email,
      source: "manual",
      external_id: email,
      raw: { __profile: { membership: "Founder", leadSource: LEAD_SOURCE } },
    })
    .select("id")
    .single();
  if (error || !data) {
    // A parallel request may have created it between the lookup and the insert.
    return findContactByEmail(email);
  }
  return String(data.id);
}

/** Add the "Fit match" tag to the Contact (crm_contacts.tags) if it is not there yet. */
async function addFitTag(contactId: string): Promise<void> {
  const { data } = await db().from("crm_contacts").select("tags").eq("id", contactId).maybeSingle();
  if (!data) return;
  const tags: string[] = Array.isArray(data.tags) ? data.tags : [];
  if (tags.includes(FIT_TAG)) return;
  await db().from("crm_contacts").update({ tags: [...tags, FIT_TAG] }).eq("id", contactId);
}

type SessionRow = {
  id: string;
  email: string | null;
  stage: string | null;
  raise: string | null;
  industry: string | null;
  revenue: string | null;
  matched_count: number | null;
  match_snapshot: MatchResult[] | null;
  source_tag: string | null;
};

function buildEntry(s: SessionRow, when: Date): string {
  const top = Array.isArray(s.match_snapshot) ? s.match_snapshot : [];
  const lines = [
    `Founder log note: Match Review saved (${LEAD_SOURCE}, ${ptStamp(when)})`,
    `Sector: ${s.industry || "not given"}`,
    `Raise: ${s.raise || "not given"}`,
    `Stage: ${s.stage || "not given"}`,
    `Revenue: ${s.revenue || "not given"}`,
    `${top.length} matched investor${top.length === 1 ? "" : "s"} shown to founder${
      s.matched_count && s.matched_count > top.length ? ` (${s.matched_count} matched in total)` : ""
    }:`,
    ...top.map((m, i) => `${i + 1}. ${m.company} (${Math.round(m.fit)}%)`),
    `Session: ${s.id}`,
  ];
  return lines.join("\n");
}

/**
 * Call after the session gains an email or a match snapshot. Safe to call repeatedly
 * and never throws: a /fit visitor must not see an error because a note failed.
 */
export async function logFitMatchNote(sessionId: string): Promise<void> {
  try {
    if (!sessionId) return;
    const { data: s } = await db()
      .from("fit_sessions")
      .select("id, email, stage, raise, industry, revenue, matched_count, match_snapshot, source_tag")
      .eq("id", sessionId)
      .maybeSingle();
    if (!s || !s.email) return;
    const snapshot = Array.isArray(s.match_snapshot) ? s.match_snapshot : [];
    if (snapshot.length === 0) return;

    const contactId = await findOrCreateContact(String(s.email).trim().toLowerCase());
    if (!contactId) return;
    await addFitTag(contactId).catch(() => {});

    // Idempotency: one entry per session.
    const { data: c } = await db().from("crm_contacts").select("source, external_id").eq("id", contactId).maybeSingle();
    if (c) {
      const { data: ann } = await db()
        .from("crm_contact_annotations")
        .select("notes")
        .eq("source", c.source)
        .eq("external_id", c.external_id)
        .maybeSingle();
      if (ann?.notes && String(ann.notes).includes(`Session: ${s.id}`)) return;
    }

    await appendContactNote(contactId, buildEntry(s as SessionRow, new Date()), null);
  } catch (err) {
    console.error("[fit/note-log-entry] failed:", err instanceof Error ? err.message : err);
  }
}
