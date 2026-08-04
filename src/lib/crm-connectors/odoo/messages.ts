// Live read of an Odoo contact's chatter (mail.message) for a res.partner.
// Server-only. Returns [] when Odoo is unconfigured or on any failure, so the
// contact page never breaks on a bad/slow Odoo. No mirror table — always fresh.
import { executeKw, odooConfigured } from "./client";

export interface OdooContactMessage {
  id: number;
  date: string | null;
  author: string | null;
  subject: string | null;
  body: string; // plain text
  type: string | null;
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
        ["id", "date", "subject", "body", "message_type", "author_id", "email_from"],
      ],
      { limit, order: "date desc" },
    );

    return (rows ?? []).map((r) => ({
      id: r.id,
      date: r.date || null,
      author: (r.author_id && r.author_id[1]) || (r.email_from || null),
      subject: r.subject || null,
      body: r.body ? stripHtml(r.body) : "",
      type: r.message_type || null,
    }));
  } catch {
    return [];
  }
}
