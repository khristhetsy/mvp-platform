/**
 * Helpers for the email composer's Preview: the page the email is shown in, and the notes
 * shown under it about things to fix before sending. Pure functions, so they are tested.
 */

/** A full HTML document shows as written (its own background and layout); a fragment is wrapped in a plain page. */
export function buildPreviewDoc(body: string): string {
  if (/<html[\s>]/i.test(body)) return body;
  return `<!doctype html><html><body style="margin:0;padding:12px 14px;font:13px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937">${body}</body></html>`;
}

/** Leftover placeholders such as [UNSUBSCRIBE LINK], [BANNER IMAGE LINK] or [First name]. */
export function findPlaceholders(html: string): string[] {
  return [...new Set(html.match(/\[(?:[A-Z][A-Z0-9 ]{3,}|First name)\]/g) ?? [])];
}

/** Things to fix before sending. Shown as a note, they never block the send. Empty body gives no notes. */
export function sendNotes(html: string, subject: string): string[] {
  if (!html.trim()) return [];
  const notes: string[] = [];
  if (!subject.trim()) notes.push("The Subject is empty.");
  const leftovers = findPlaceholders(html);
  if (leftovers.length) notes.push(`Still has a placeholder to replace: ${leftovers.join(", ")}.`);
  return notes;
}
