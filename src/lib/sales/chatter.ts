// Sales Hub chatter IO: loads the merged timeline for an opportunity or contact,
// and edits, soft deletes and restores notes. Odoo is read and, when asked, posted
// to (new notes only). Nothing here edits or deletes anything in Odoo.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";
import { fetchMessageById, fetchPartnerMessages, fetchRecordMessages } from "@/lib/crm-connectors/odoo/messages";
import { postOdooNote, type OdooNoteTarget } from "@/lib/crm-connectors/odoo/notes";
import { logActivity } from "@/lib/sales/activity";
import {
  NOTE_KINDS, isNoteKind, mergeTimeline, parseOdooItemId, rowToItem,
  type NativeRow, type OdooMsg, type TimelineItem,
} from "@/lib/sales/chatter-merge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type ChatterScope = { opportunityId?: string | null; contactCrmId?: string | null };
export type OdooLinks = { partnerId: number | null; leads: Array<{ id: number; name: string }>; noteTarget: OdooNoteTarget | null };

const ROW_COLS = "id, kind, summary, created_at, edited_at, deleted_at, odoo_message_id, meta, actor:profiles!sales_activity_log_actor_id_fkey(full_name, email)";
const RECENTLY_DELETED_DAYS = 30;

function toRow(r: Record<string, unknown>): NativeRow {
  const a = r.actor as { full_name?: string | null; email?: string | null } | null;
  const meta = (r.meta ?? null) as { odoo_author?: string | null } | null;
  return {
    id: String(r.id),
    kind: String(r.kind),
    summary: String(r.summary ?? ""),
    created_at: String(r.created_at),
    actor_name: a?.full_name ?? a?.email ?? null,
    edited_at: (r.edited_at as string | null) ?? null,
    deleted_at: (r.deleted_at as string | null) ?? null,
    odoo_message_id: r.odoo_message_id == null ? null : Number(r.odoo_message_id),
    odoo_author: meta?.odoo_author ?? null,
  };
}

async function rows(build: (q: any) => any): Promise<NativeRow[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await build(db().from("sales_activity_log").select(ROW_COLS));
  if (error) throw new Error(`Note log: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(toRow);
}

// ---------------------------------------------------------------- Odoo links

async function partnerIdFor(contactCrmId: string | null | undefined): Promise<number | null> {
  if (!contactCrmId) return null;
  const { data: c } = await db().from("crm_contacts").select("source, external_id").eq("id", contactCrmId).maybeSingle();
  const id = c?.source === "odoo" ? Number(c.external_id) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Which Odoo records back this scope. For an opportunity: the cached odoo_lead_id,
 * else a numeric Odoo import id, else a crm.lead search by the contact's Odoo partner
 * or email. A single match is cached on the opportunity. Best-effort: Odoo errors
 * just mean no links.
 */
export async function resolveOdooLinks(scope: ChatterScope): Promise<OdooLinks> {
  const none: OdooLinks = { partnerId: null, leads: [], noteTarget: null };
  if (!odooConfigured()) return none;
  try {
    if (!scope.opportunityId) {
      const partnerId = await partnerIdFor(scope.contactCrmId);
      return { partnerId, leads: [], noteTarget: partnerId ? { model: "res.partner", id: partnerId, label: "Odoo contact" } : null };
    }

    const { data: o } = await db().from("sales_opportunities").select("*").eq("id", scope.opportunityId).maybeSingle();
    if (!o) return none;
    const partnerId = await partnerIdFor((o.contact_crm_id as string | null) ?? scope.contactCrmId);
    const title = String(o.title ?? "");
    let leads: Array<{ id: number; name: string }> = [];

    const cached = Number(o.odoo_lead_id);
    const imported = o.external_source === "odoo" && /^\d+$/.test(String(o.external_id ?? "")) ? Number(o.external_id) : NaN;
    if (Number.isInteger(cached) && cached > 0) {
      leads = [{ id: cached, name: title }];
    } else if (Number.isInteger(imported) && imported > 0) {
      leads = [{ id: imported, name: title }];
      await db().from("sales_opportunities").update({ odoo_lead_id: imported }).eq("id", scope.opportunityId);
    } else {
      const email = String(o.contact_email ?? "").trim();
      const or: unknown[] = [];
      if (partnerId) or.push(["partner_id", "=", partnerId]);
      if (email) or.push(["email_from", "=ilike", email]);
      if (or.length > 0) {
        const domain = [["type", "=", "opportunity"], ...(or.length === 2 ? ["|", ...or] : or)];
        const found = await executeKw<Array<{ id: number; name: string }>>(
          "crm.lead", "search_read", [domain, ["id", "name"]], { limit: 10, order: "id desc", context: { active_test: false } },
        );
        const byTitle = found.filter((l) => l.name.trim().toLowerCase() === title.trim().toLowerCase());
        leads = found.length === 1 ? found : byTitle.length === 1 ? byTitle : found;
        if (leads.length === 1) {
          await db().from("sales_opportunities").update({ odoo_lead_id: leads[0].id }).eq("id", scope.opportunityId);
        }
      }
    }

    const noteTarget: OdooNoteTarget | null =
      leads.length === 1 ? { model: "crm.lead", id: leads[0].id, label: "Odoo opportunity" }
      : partnerId ? { model: "res.partner", id: partnerId, label: "Odoo contact" }
      : null;
    return { partnerId, leads, noteTarget };
  } catch {
    return none;
  }
}

async function odooMessages(links: OdooLinks): Promise<OdooMsg[]> {
  const lists = await Promise.all([
    ...links.leads.map((l) => fetchRecordMessages("crm.lead", l.id, 50).then((ms) => ms.map((m) => ({ ...m, origin: "Odoo opportunity" })))),
    links.partnerId ? fetchPartnerMessages(String(links.partnerId), 50).then((ms) => ms.map((m) => ({ ...m, origin: "Odoo contact" }))) : Promise.resolve([]),
  ]);
  return lists.flat();
}

// ---------------------------------------------------------------- timeline

/** Native rows in scope. An opportunity also carries its contact's contact-level notes. */
async function scopedRows(scope: ChatterScope): Promise<NativeRow[]> {
  if (scope.opportunityId) {
    const [own, contactNotes] = await Promise.all([
      rows((q) => q.eq("opportunity_id", scope.opportunityId).order("created_at", { ascending: false }).limit(200)),
      scope.contactCrmId
        ? rows((q) => q.eq("contact_crm_id", scope.contactCrmId).is("opportunity_id", null).in("kind", ["note", "odoo_note"]).order("created_at", { ascending: false }).limit(100))
        : Promise.resolve([] as NativeRow[]),
    ]);
    return [...own, ...contactNotes];
  }
  if (scope.contactCrmId) {
    return rows((q) => q.eq("contact_crm_id", scope.contactCrmId).order("created_at", { ascending: false }).limit(200));
  }
  return [];
}

export async function loadTimeline(scope: ChatterScope): Promise<{ activity: TimelineItem[]; odooTarget: OdooNoteTarget | null }> {
  const [native, links] = await Promise.all([scopedRows(scope), resolveOdooLinks(scope)]);
  const odoo = await odooMessages(links);
  // Rows edited or hidden from another page (e.g. an Odoo contact note edited on the
  // contact) still apply here: load them by Odoo message id.
  const known = new Set(native.map((r) => r.id));
  const ids = [...new Set(odoo.map((m) => m.id))];
  const overlays = ids.length
    ? (await rows((q) => q.in("odoo_message_id", ids))).filter((r) => !known.has(r.id))
    : [];
  return { activity: mergeTimeline([...native, ...overlays], odoo), odooTarget: links.noteTarget };
}

/** Notes deleted in the last 30 days, for "Recently deleted". */
export async function listDeletedNotes(scope: ChatterScope): Promise<TimelineItem[]> {
  const since = new Date(Date.now() - RECENTLY_DELETED_DAYS * 86400000).toISOString();
  const base = (q: any) => q.not("deleted_at", "is", null).gte("deleted_at", since).in("kind", [...NOTE_KINDS]).order("deleted_at", { ascending: false }).limit(50); // eslint-disable-line @typescript-eslint/no-explicit-any
  const lists = await Promise.all([
    scope.opportunityId ? rows((q) => base(q.eq("opportunity_id", scope.opportunityId))) : Promise.resolve([] as NativeRow[]),
    scope.contactCrmId ? rows((q) => base(q.eq("contact_crm_id", scope.contactCrmId))) : Promise.resolve([] as NativeRow[]),
  ]);
  const byId = new Map<string, NativeRow>();
  for (const r of lists.flat()) byId.set(r.id, r);
  return [...byId.values()].map(rowToItem);
}

// ---------------------------------------------------------------- writes

export class NoteError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function snippet(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

/** Log a new note; optionally also post it to Odoo. Returns the row id and sync result. */
export async function createNote(
  text: string, scope: ChatterScope, actorId: string, syncToOdoo: boolean,
): Promise<{ id: string; odooSynced: boolean; odooError: string | null }> {
  const summary = text.trim().slice(0, 4000);
  if (!summary) throw new NoteError("A note is required.");
  let contactCrmId = scope.contactCrmId ?? null;
  if (!contactCrmId && scope.opportunityId) {
    const { data } = await db().from("sales_opportunities").select("contact_crm_id").eq("id", scope.opportunityId).maybeSingle();
    contactCrmId = (data?.contact_crm_id as string) ?? null;
  }
  const { data, error } = await db().from("sales_activity_log").insert({
    kind: scope.opportunityId ? "opp_note" : "note", summary, actor_id: actorId,
    opportunity_id: scope.opportunityId ?? null, contact_crm_id: contactCrmId,
  }).select("id").single();
  if (error) throw new NoteError(`Couldn't save note: ${error.message}`, 500);
  const id = String(data.id);

  if (!syncToOdoo) return { id, odooSynced: false, odooError: null };
  try {
    const { noteTarget } = await resolveOdooLinks({ ...scope, contactCrmId });
    if (!noteTarget) return { id, odooSynced: false, odooError: "No linked Odoo record." };
    const msgId = await postOdooNote(noteTarget, summary);
    if (msgId) await db().from("sales_activity_log").update({ odoo_message_id: msgId }).eq("id", id);
    return { id, odooSynced: true, odooError: null };
  } catch (err) {
    return { id, odooSynced: false, odooError: err instanceof Error ? err.message : "Odoo post failed." };
  }
}

/**
 * Give an Odoo note an iCapOS row so it can be edited or hidden here. Reuses the row
 * if one already mirrors that message. Verifies the message with Odoo first.
 */
async function adoptOdooNote(msgId: number, scope: ChatterScope, actorId: string): Promise<NativeRow> {
  const existing = await rows((q) => q.eq("odoo_message_id", msgId).limit(1));
  if (existing[0]) return existing[0];
  const msg = await fetchMessageById(msgId);
  if (!msg) throw new NoteError("That Odoo note couldn't be loaded. Try again.", 502);
  if (!msg.isNote) throw new NoteError("Only notes can be edited or deleted.");
  const { data, error } = await db().from("sales_activity_log").insert({
    kind: "odoo_note", summary: msg.body, actor_id: actorId,
    opportunity_id: scope.opportunityId ?? null, contact_crm_id: scope.contactCrmId ?? null,
    odoo_message_id: msgId, created_at: msg.date ?? new Date().toISOString(),
    meta: { odoo_author: msg.author, odoo_original: msg.body },
  }).select(ROW_COLS).single();
  if (error) throw new NoteError(`Couldn't save note: ${error.message}`, 500);
  return toRow(data as Record<string, unknown>);
}

async function loadNote(id: string, scope: ChatterScope, actorId: string): Promise<NativeRow> {
  const odooId = parseOdooItemId(id);
  if (odooId != null) return adoptOdooNote(odooId, scope, actorId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NoteError("Unknown note.", 404);
  const found = await rows((q) => q.eq("id", id).limit(1));
  const row = found[0];
  if (!row) throw new NoteError("Note not found.", 404);
  if (!isNoteKind(row.kind)) throw new NoteError("Only notes can be edited or deleted.");
  return row;
}

async function audit(kind: "note_edited" | "note_deleted" | "note_restored", summary: string, scope: ChatterScope, actorId: string) {
  await logActivity({ kind, summary, actorId, opportunityId: scope.opportunityId ?? null, contactCrmId: scope.contactCrmId ?? null });
}

/**
 * Change a note's text. `undo` puts back the previous text and edited_at exactly
 * (so undoing the first edit clears the "edited" mark).
 */
export async function editNote(
  id: string, text: string, scope: ChatterScope, actorId: string, undo?: { editedAt: string | null },
): Promise<TimelineItem> {
  const summary = text.trim().slice(0, 4000);
  if (!summary) throw new NoteError("A note can't be empty. Delete it instead.");
  const row = await loadNote(id, scope, actorId);
  if (row.deleted_at) throw new NoteError("Restore the note before editing it.");
  const editedAt = undo ? undo.editedAt : new Date().toISOString();
  const { data, error } = await db().from("sales_activity_log")
    .update({ summary, edited_at: editedAt, edited_by: actorId }).eq("id", row.id).select(ROW_COLS).single();
  if (error) throw new NoteError(`Couldn't save note: ${error.message}`, 500);
  await audit("note_edited", undo ? `Note edit undone: ${snippet(summary)}` : `Note edited: ${snippet(summary)}`, scope, actorId);
  return rowToItem(toRow(data as Record<string, unknown>));
}

export async function deleteNote(id: string, scope: ChatterScope, actorId: string): Promise<TimelineItem> {
  const row = await loadNote(id, scope, actorId);
  const { data, error } = await db().from("sales_activity_log")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId }).eq("id", row.id).select(ROW_COLS).single();
  if (error) throw new NoteError(`Couldn't delete note: ${error.message}`, 500);
  await audit("note_deleted", `Note deleted: ${snippet(row.summary)}`, scope, actorId);
  return rowToItem(toRow(data as Record<string, unknown>));
}

export async function restoreNote(id: string, scope: ChatterScope, actorId: string): Promise<TimelineItem> {
  const row = await loadNote(id, scope, actorId);
  const { data, error } = await db().from("sales_activity_log")
    .update({ deleted_at: null, deleted_by: null }).eq("id", row.id).select(ROW_COLS).single();
  if (error) throw new NoteError(`Couldn't restore note: ${error.message}`, 500);
  await audit("note_restored", `Note restored: ${snippet(row.summary)}`, scope, actorId);
  return rowToItem(toRow(data as Record<string, unknown>));
}
