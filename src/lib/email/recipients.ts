/**
 * One recipient parser for every send path (Resend, Gmail send, Gmail drafts).
 * Pure, no I/O. Accepts a string or array, with addresses separated by commas,
 * semicolons, spaces or line breaks, and "Name <addr>" entries.
 */

function addressOf(entry: string): string {
  const m = entry.match(/<([^>]*)>\s*$/);
  return (m ? m[1] : entry).trim().toLowerCase();
}

export function parseRecipients(value?: string | string[] | null): string[] {
  if (!value) return [];
  const chunks = (Array.isArray(value) ? value : [String(value)]).flatMap((v) => String(v).split(/[,;\r\n]+/));
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (entry: string) => {
    const e = entry.trim();
    if (!e.includes("@")) return;
    const key = addressOf(e);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  for (const chunk of chunks) {
    const c = chunk.trim();
    if (!c) continue;
    // "Name <addr>" stays whole; bare addresses split on whitespace.
    if (c.includes("<") && c.includes(">")) push(c);
    else c.split(/\s+/).forEach(push);
  }
  return out;
}

/** The value for a To, Cc or Bcc header: clean addresses joined with ", ". */
export function recipientHeader(value?: string | string[] | null): string {
  return parseRecipients(value).join(", ");
}
