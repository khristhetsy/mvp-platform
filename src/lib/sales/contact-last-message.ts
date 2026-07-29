/**
 * Resolves the single most-recent "message communicated" for a page of contacts,
 * merging three real sources and picking whichever is newest per contact:
 *   - note   → the last dated entry in crm_contacts.note (internal log)
 *   - sent   → an outreach email sent to them (investor automated, by profile;
 *              founder manual, by email)
 *   - reply  → an inbound reply captured on a manual-outreach recipient
 *
 * Bulk (a handful of `IN (...)` queries per page), so it stays fast on the
 * ~18k-row list. Every lookup is defensive — a missing table never breaks the list.
 */

export type LastMessageDirection = "sent" | "reply" | "note";
export type LastMessage = { direction: LastMessageDirection; text: string; at: string };

type Row = { id: string; email: string | null; note: string | null };

/** Extract the newest `[YYYY-MM-DD] text` line from a note blob (falls back to
 *  the last non-empty line, undated). */
function parseLastNote(note: string | null): { text: string; at: string } | null {
  if (!note) return null;
  const lines = note.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1];
  const m = last.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/);
  if (m) return { text: m[2] || "Note", at: `${m[1]}T00:00:00.000Z` };
  return { text: last, at: "" };
}

function norm(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export async function loadLastMessages(
  // crm_contacts / outreach tables aren't all in the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  rows: Row[],
): Promise<Map<string, LastMessage>> {
  const out = new Map<string, LastMessage>();
  const emails = [...new Set(rows.map((r) => norm(r.email)).filter(Boolean))];

  // email → platform profile id (for investor automated sends, keyed by profile).
  const profileByEmail = new Map<string, string>();
  if (emails.length) {
    try {
      const { data } = await db.from("profiles").select("id, email").in("email", emails);
      for (const p of (data ?? []) as Array<{ id: string; email: string | null }>) {
        if (p.email) profileByEmail.set(norm(p.email), p.id);
      }
    } catch { /* ignore */ }
  }
  const profileIds = [...profileByEmail.values()];

  // Latest automated Founder-Preview send per investor profile.
  const sentByProfile = new Map<string, string>();
  if (profileIds.length) {
    try {
      const { data } = await db
        .from("investor_outreach_recipients")
        .select("investor_ref, sent_at")
        .in("investor_ref", profileIds)
        .eq("status", "sent")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false });
      for (const r of (data ?? []) as Array<{ investor_ref: string; sent_at: string | null }>) {
        if (r.sent_at && !sentByProfile.has(r.investor_ref)) sentByProfile.set(r.investor_ref, r.sent_at);
      }
    } catch { /* ignore */ }
  }

  // Manual-outreach sends / replies, keyed by email.
  const manualByEmail = new Map<string, { sentAt: string | null; repliedAt: string | null }>();
  if (emails.length) {
    try {
      const { data } = await db
        .from("founder_manual_outreach_recipients")
        .select("email, last_sent_at, replied_at")
        .in("email", emails);
      for (const r of (data ?? []) as Array<{ email: string | null; last_sent_at: string | null; replied_at: string | null }>) {
        const key = norm(r.email);
        if (!key) continue;
        const cur = manualByEmail.get(key) ?? { sentAt: null, repliedAt: null };
        if (r.last_sent_at && (!cur.sentAt || r.last_sent_at > cur.sentAt)) cur.sentAt = r.last_sent_at;
        if (r.replied_at && (!cur.repliedAt || r.replied_at > cur.repliedAt)) cur.repliedAt = r.replied_at;
        manualByEmail.set(key, cur);
      }
    } catch { /* ignore */ }
  }

  for (const r of rows) {
    const email = norm(r.email);
    const candidates: LastMessage[] = [];

    const note = parseLastNote(r.note);
    if (note) candidates.push({ direction: "note", text: note.text, at: note.at });

    const pid = email ? profileByEmail.get(email) : undefined;
    const sentInv = pid ? sentByProfile.get(pid) : undefined;
    if (sentInv) candidates.push({ direction: "sent", text: "Founder Preview sent", at: sentInv });

    const man = email ? manualByEmail.get(email) : undefined;
    if (man?.sentAt) candidates.push({ direction: "sent", text: "Outreach email sent", at: man.sentAt });
    if (man?.repliedAt) candidates.push({ direction: "reply", text: "Replied to outreach", at: man.repliedAt });

    if (candidates.length === 0) continue;
    // Newest first; undated notes (at: "") sort last, so they only win when alone.
    candidates.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    out.set(r.id, candidates[0]);
  }

  return out;
}
