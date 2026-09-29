// Post an internal "Log note" to an Odoo record's chatter (crm.lead or res.partner).
// Additive only: this never edits or deletes anything in Odoo.
import { executeKw, odooConfigured } from "./client";

export type OdooNoteTarget = { model: "crm.lead" | "res.partner"; id: number; label: string };

/** Plain text → minimal HTML for an Odoo chatter body (escaped, line breaks kept). */
export function noteTextToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return `<p>${esc.replace(/\r?\n/g, "<br>")}</p>`;
}

function toId(result: unknown): number | null {
  if (typeof result === "number") return result;
  if (Array.isArray(result) && typeof result[0] === "number") return result[0];
  return null;
}

/**
 * Post a note and return the new mail.message id (null when Odoo returned none).
 * Newer Odoo escapes string bodies unless body_is_html is set; older versions reject
 * that kwarg, so we retry without it.
 */
export async function postOdooNote(target: OdooNoteTarget, text: string): Promise<number | null> {
  if (!odooConfigured()) throw new Error("Odoo isn't configured.");
  const base = { body: noteTextToHtml(text), message_type: "comment", subtype_xmlid: "mail.mt_note" };
  try {
    return toId(await executeKw(target.model, "message_post", [[target.id]], { ...base, body_is_html: true }));
  } catch (err) {
    if (!/body_is_html/i.test(err instanceof Error ? err.message : "")) throw err;
    return toId(await executeKw(target.model, "message_post", [[target.id]], base));
  }
}
