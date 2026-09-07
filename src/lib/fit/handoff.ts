/**
 * /fit → Sales Hub handoff (build-spec §7). On a booking that carries a fit session,
 * write the lead into Sales Hub Contacts with its source tag and the four answers.
 *
 * Rules:
 *  - Match on NORMALISED email (lowercase, trim, strip +tag, strip dots for Gmail).
 *  - A hit appends to the existing contact and NEVER overwrites the original lead
 *    source — first touch is the valuable attribution.
 *  - A miss creates one new founder prospect tagged with the source.
 *  - Incomplete sessions (missing any answer) never become contacts — they only tell
 *    you where people quit.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

/** lowercase · trim · strip +tag · strip dots in the Gmail local part. */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return e;
  const domain = e.slice(at + 1);
  let local = e.slice(0, at).split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

type FitSessionRow = {
  stage: string | null; raise: string | null; industry: string | null; revenue: string | null;
  matched_count: number | null; source_tag: string | null;
};

export async function handoffFitSession(sessionId: string, booker: { name: string; email: string }): Promise<void> {
  if (!sessionId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;

  const { data: s } = await db.from("fit_sessions").select("stage, raise, industry, revenue, matched_count, source_tag").eq("id", sessionId).maybeSingle();
  const sess = s as FitSessionRow | null;
  if (!sess || !sess.stage || !sess.raise || !sess.industry || !sess.revenue) return; // complete sessions only

  const fit = {
    stage: sess.stage, raise: sess.raise, industry: sess.industry, revenue: sess.revenue,
    matched_count: sess.matched_count, source_tag: sess.source_tag, session_id: sessionId, at: new Date().toISOString(),
  };

  // Find an existing contact by normalised email. crm_contacts stores raw emails, so
  // compare normalised against the small candidate set sharing the domain.
  const norm = normalizeEmail(booker.email);
  const domain = norm.slice(norm.indexOf("@") + 1);
  const { data: candidates } = await db.from("crm_contacts").select("id, email, raw").ilike("email", `%@${domain}`).limit(200);
  const hit = ((candidates ?? []) as { id: string; email: string | null; raw: Record<string, unknown> | null }[])
    .find((c) => c.email && normalizeEmail(c.email) === norm);

  if (hit) {
    // Append the fit answers; keep the existing lead source (first touch wins).
    const raw = (hit.raw ?? {}) as Record<string, unknown>;
    const prof = (raw.__profile ?? {}) as Record<string, unknown>;
    raw.__profile = { ...prof, fit };
    await db.from("crm_contacts").update({ raw }).eq("id", hit.id);
    return;
  }

  await db.from("crm_contacts").insert({
    source: "fit",
    external_id: sessionId,
    module: "founder",
    name: booker.name,
    email: booker.email,
    raw: { __profile: { fit, leadSource: sess.source_tag } },
    overrides: { lead_source: sess.source_tag },
    synced_at: new Date().toISOString(),
  });
}
