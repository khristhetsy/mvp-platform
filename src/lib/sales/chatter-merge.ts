// Pure merge for the Sales Hub chatter: native iCapOS rows + Odoo chatter → one
// timeline split into notes, messages and system activity. No IO, unit-tested.

export const NOTE_KINDS = ["note", "opp_note", "odoo_note"] as const;
const MESSAGE_KINDS = new Set(["email", "email_draft", "message", "call", "odoo_message"]);

export type NativeRow = {
  id: string;
  kind: string;
  summary: string;
  created_at: string;
  actor_name: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  odoo_message_id: number | null;
  /** Original Odoo author for a row that mirrors an Odoo note. */
  odoo_author?: string | null;
  /** For a sent email: which mailbox sent it ("icapos" or "gmail"). */
  via?: string | null;
};

export type OdooMsg = {
  id: number;
  date: string | null;
  author: string | null;
  subject: string | null;
  body: string;
  isNote: boolean;
  /** Where it came from, shown as a badge: "Odoo opportunity" or "Odoo contact". */
  origin: string;
};

export type TimelineGroup = "note" | "message" | "system";

export type TimelineItem = {
  id: string;
  kind: string;
  summary: string;
  actor_name: string | null;
  created_at: string;
  group: TimelineGroup;
  source: "icapos" | "odoo";
  origin: string | null;
  editable: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  odoo_synced: boolean;
  via: string | null;
};

export function isNoteKind(kind: string): boolean {
  return (NOTE_KINDS as readonly string[]).includes(kind);
}

export function groupOf(kind: string): TimelineGroup {
  if (isNoteKind(kind)) return "note";
  if (MESSAGE_KINDS.has(kind)) return "message";
  return "system";
}

export function rowToItem(r: NativeRow): TimelineItem {
  const odoo = r.kind === "odoo_note" || r.kind === "odoo_message";
  return {
    id: r.id,
    kind: r.kind,
    summary: r.summary,
    actor_name: (odoo ? r.odoo_author : null) ?? r.actor_name,
    created_at: r.created_at,
    group: groupOf(r.kind),
    source: odoo ? "odoo" : "icapos",
    origin: odoo ? "Odoo" : null,
    editable: isNoteKind(r.kind),
    edited_at: r.edited_at,
    deleted_at: r.deleted_at,
    odoo_synced: !odoo && r.odoo_message_id != null,
    via: r.via ?? null,
  };
}

function odooToItem(m: OdooMsg): TimelineItem {
  return {
    id: `odoo:${m.id}`,
    kind: m.isNote ? "odoo_note" : "odoo_message",
    summary: (m.subject && !m.isNote ? `${m.subject}\n` : "") + m.body,
    actor_name: m.author,
    created_at: m.date ?? new Date(0).toISOString(),
    group: m.isNote ? "note" : "message",
    source: "odoo",
    origin: m.origin,
    editable: m.isNote,
    edited_at: null,
    deleted_at: null,
    odoo_synced: false,
    via: null,
  };
}

/**
 * Merge native rows and Odoo messages, newest first.
 *  - An Odoo message that an iCapOS row already mirrors (odoo_message_id) is shown
 *    once, as the iCapOS row, so edits and deletes made here win.
 *  - Soft-deleted rows are dropped, and they still hide their Odoo copy.
 *  - The same Odoo message reached twice (opportunity and contact chatter) shows once.
 */
export function mergeTimeline(rows: NativeRow[], odoo: OdooMsg[]): TimelineItem[] {
  const byId = new Map<string, NativeRow>();
  for (const r of rows) byId.set(r.id, r);
  const linked = new Set<number>();
  for (const r of byId.values()) if (r.odoo_message_id != null) linked.add(Number(r.odoo_message_id));

  const items: TimelineItem[] = [];
  for (const r of byId.values()) if (!r.deleted_at) items.push(rowToItem(r));

  const seen = new Set<number>();
  for (const m of odoo) {
    if (!(m.body || m.subject)) continue;
    if (linked.has(m.id) || seen.has(m.id)) continue;
    seen.add(m.id);
    items.push(odooToItem(m));
  }
  return items.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/** "odoo:123" → 123; anything else → null. */
export function parseOdooItemId(id: string): number | null {
  const m = /^odoo:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}
