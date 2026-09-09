// Live read of an Odoo contact's chatter (mail.message) for a res.partner.
// Server-only. Returns [] when Odoo is unconfigured or on any failure, so the
// contact page never breaks on a bad/slow Odoo. No mirror table — always fresh.
import { executeKw, odooConfigured } from "./client";

export interface OdooContactMessage {
  id: number;
  date: string | null;   // ISO (UTC)
  author: string | null;
  subject: string | null;
  body: string; // plain text
  type: string | null;
  isNote: boolean; // internal "Log note" (subtype Note) vs an outgoing message
}

// Odoo datetimes come as "YYYY-MM-DD HH:MM:SS" in UTC with no zone — normalize to ISO
// so the chatter timeline sorts and displays them correctly.
function toIso(d: string | false | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type RawMessage = {
  id: number;
  date?: string | false;
  subject?: string | false;
  body?: string | false;
  message_type?: string | false;
  author_id?: [number, string] | false;
  email_from?: string | false;
  subtype_id?: [number, string] | false;
};

/** Fetch the most recent chatter messages for an Odoo partner (by res.partner id). */
export async function fetchPartnerMessages(externalId: string, limit = 30): Promise<OdooContactMessage[]> {
  if (!odooConfigured() || !externalId) return [];
  const partnerId = Number(externalId);
  if (!Number.isFinite(partnerId)) return [];

  try {
    const rows = await executeKw<RawMessage[]>(
      "mail.message",
      "search_read",
      [
        [
          ["model", "=", "res.partner"],
          ["res_id", "=", partnerId],
        ],
        ["id", "date", "subject", "body", "message_type", "author_id", "email_from", "subtype_id"],
      ],
      { limit, order: "date desc" },
    );

    return (rows ?? []).map((r) => {
      const subtype = (r.subtype_id && r.subtype_id[1]) || "";
      return {
        id: r.id,
        date: toIso(r.date),
        author: (r.author_id && r.author_id[1]) || (r.email_from || null),
        subject: r.subject || null,
        body: r.body ? stripHtml(r.body) : "",
        type: r.message_type || null,
        // A chatter entry is an internal "Log note" ONLY when Odoo tagged it with the
        // Note subtype (mail.mt_note). Everything else — Discussions, emails, and
        // integration-posted messages that arrive as message_type 'notification' — is a
        // real message to the contact and belongs in the Send message thread. (We do NOT
        // key off message_type here: 'notification' is used for both real outbound mail
        // logged by integrations and for system tracking, so subtype is the reliable signal.)
        isNote: /note/i.test(subtype),
      };
    });
  } catch {
    return [];
  }
}
