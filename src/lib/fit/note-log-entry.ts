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
  const { data } = await db().from("crm_contacts").select("id").ilike("email", email).limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? String(row.id) : null;
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
