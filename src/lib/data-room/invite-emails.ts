/** Most investors a founder can invite in one go. Keeps one send from becoming a blast. */
export const MAX_INVITES_PER_SEND = 20;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Split what a founder typed or pasted into emails.
 * Accepts commas, semicolons, spaces and new lines. Lowercases, drops repeats,
 * and keeps anything that is not an email apart so the sheet can say so.
 */
export function parseInviteEmails(raw: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const value = part.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    (EMAIL_RE.test(value) ? valid : invalid).push(value);
  }
  return { valid, invalid };
}
