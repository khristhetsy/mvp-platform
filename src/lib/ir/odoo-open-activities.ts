import "server-only";

/**
 * Open Odoo activities (mail.activity) on investors, read live for the task Matching tab.
 * The Odoo import brings completed history into iCapOS but never the open ones, so the
 * overdue calls and follow ups staff planned in Odoo are read here, by each investor's
 * Odoo contact (res.partner = crm_contacts.external_id), and changed back in Odoo:
 * done (action_feedback), edit (summary / deadline) and cancel (unlink, as Odoo does).
 * Returns nothing when Odoo isn't configured or can't be reached.
 */
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";
import { db } from "@/lib/ir/db";

export type OdooOpenActivity = { id: number; type: string; summary: string; due: string | null; user: string | null; url: string | null };

type Row = { id: number; summary: string | false; activity_type_id: [number, string] | false; date_deadline: string | false; user_id: [number, string] | false; res_id: number };

const base = () => process.env.ODOO_URL?.replace(/\/+$/, "") ?? null;

/** Open Odoo activities per match id, soonest deadline first. */
export async function openOdooActivitiesByMatch(matchIds: string[]): Promise<{ configured: boolean; byMatch: Record<string, OdooOpenActivity[]> }> {
  if (!odooConfigured()) return { configured: false, byMatch: {} };
  if (!matchIds.length) return { configured: true, byMatch: {} };
  const { data: ms } = await db().from("ir_matches").select("id, investor_contact_id").in("id", matchIds);
  const matches = (ms ?? []) as Array<{ id: string; investor_contact_id: string }>;
  const { data: cs } = matches.length ? await db().from("crm_contacts").select("id, external_id").eq("source", "odoo").in("id", [...new Set(matches.map((m) => m.investor_contact_id))]) : { data: [] };
  const partnerOf = new Map(((cs ?? []) as Array<{ id: string; external_id: string | null }>).map((c) => [c.id, Number(c.external_id)]).filter(([, n]) => Number.isInteger(n) && (n as number) > 0) as Array<[string, number]>);
  const partnerIds = [...new Set(partnerOf.values())];
  if (!partnerIds.length) return { configured: true, byMatch: {} };
  let rows: Row[] = [];
  try {
    rows = await executeKw<Row[]>("mail.activity", "search_read", [[["res_model", "=", "res.partner"], ["res_id", "in", partnerIds]]], { fields: ["summary", "activity_type_id", "date_deadline", "user_id", "res_id"], limit: 5000, order: "date_deadline asc" });
  } catch { return { configured: true, byMatch: {} }; }
  const byPartner = new Map<number, OdooOpenActivity[]>();
  for (const r of rows ?? []) {
    const type = r.activity_type_id ? r.activity_type_id[1] : "To-Do";
    const act: OdooOpenActivity = {
      id: r.id, type, summary: typeof r.summary === "string" && r.summary.trim() ? r.summary.trim() : type,
      due: typeof r.date_deadline === "string" ? r.date_deadline : null, user: r.user_id ? r.user_id[1] : null,
      url: base() ? `${base()}/web#id=${r.res_id}&model=res.partner&view_type=form` : null,
    };
    byPartner.set(r.res_id, [...(byPartner.get(r.res_id) ?? []), act]);
  }
  const byMatch: Record<string, OdooOpenActivity[]> = {};
  for (const m of matches) { const p = partnerOf.get(m.investor_contact_id); const list = p ? byPartner.get(p) : undefined; if (list?.length) byMatch[m.id] = list; }
  return { configured: true, byMatch };
}

export async function doneOdooActivity(id: number): Promise<void> {
  await executeKw("mail.activity", "action_feedback", [[id]], { feedback: "Completed from iCapOS" });
}
export async function editOdooActivity(id: number, patch: { summary?: string; due?: string | null }): Promise<void> {
  const vals: Record<string, unknown> = {};
  if (patch.summary !== undefined) vals.summary = patch.summary || false;
  if (patch.due) vals.date_deadline = patch.due;
  if (!Object.keys(vals).length) return;
  const ok = await executeKw<boolean>("mail.activity", "write", [[id], vals]);
  if (!ok) throw new Error("Odoo rejected the change.");
}
export async function cancelOdooActivity(id: number): Promise<void> {
  await executeKw("mail.activity", "unlink", [[id]]);
}
