/** Pure rules for IR share links, kept apart from the database code so they can be tested. */
export type ShareKind = "data_room" | "term_sheet";

/** An address as stored and compared: trimmed, lower case; a "+" read back from a query string as a space is restored. */
export function normShareEmail(e: string | null | undefined): string {
  return (e ?? "").trim().replace(/ /g, "+").toLowerCase();
}

/** Whether this email may open the link now, and why not when it can't. */
export function canOpenShare(link: { recipients: string[]; expires_at: string | null; revoked_at: string | null }, email: string | null | undefined, now: number = Date.now()): { ok: true } | { ok: false; reason: "revoked" | "expired" | "not_recipient" } {
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (link.expires_at && Date.parse(link.expires_at) <= now) return { ok: false, reason: "expired" };
  const e = normShareEmail(email);
  if (!e || !link.recipients.map(normShareEmail).includes(e)) return { ok: false, reason: "not_recipient" };
  return { ok: true };
}
