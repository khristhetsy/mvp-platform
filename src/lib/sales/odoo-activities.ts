/**
 * Bring Odoo activities (mail.activity — calls, emails, meetings, to-dos) into the
 * iCapOS Sales Hub Tasks list. Read-only except for completeOdooActivity, which marks
 * the activity done back in Odoo. Dormant (returns []) when Odoo isn't configured.
 */
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";
import type { SalesTask } from "@/lib/sales/tasks";

/** A Task-shaped row sourced from Odoo. `id` is prefixed `odoo:<n>` so it never
 *  collides with a Supabase task id, and the client can route actions accordingly. */
export type OdooActivityTask = SalesTask & { source: "odoo"; odoo_url: string | null };

type ActivityRow = {
  id: number;
  summary: string | false;
  activity_type_id: [number, string] | false;
  date_deadline: string | false;
  user_id: [number, string] | false;
  res_model: string | false;
  res_id: number | false;
  res_name: string | false;
};

function odooWebUrl(model: string | false, resId: number | false): string | null {
  const base = process.env.ODOO_URL?.replace(/\/+$/, "");
  if (!base || !model || !resId) return null;
  return `${base}/web#id=${resId}&model=${model}&view_type=form`;
}

function mapActivity(a: ActivityRow): OdooActivityTask {
  const typeName = a.activity_type_id ? a.activity_type_id[1] : "To-Do";
  const summary = typeof a.summary === "string" && a.summary.trim() ? a.summary.trim() : null;
  const resName = typeof a.res_name === "string" ? a.res_name : null;
  return {
    id: `odoo:${a.id}`,
    title: summary ?? (resName ? `${typeName} — ${resName}` : typeName),
    task_type: typeName,
    summary,
    due_date: typeof a.date_deadline === "string" ? a.date_deadline : null,
    status: "open",
    assignee_id: null,
    assignee_name: a.user_id ? a.user_id[1] : null,
    opportunity_id: null,
    contact_crm_id: null,
    contact_name: resName,
    created_at: "",
    done_at: null,
    opportunity_status: null,
    opportunity_name: resName,
    source: "odoo",
    odoo_url: odooWebUrl(a.res_model, a.res_id),
  };
}

/** Read open Odoo activities. `onlyOverdue` limits to past-deadline items. */
export async function listOdooActivities(opts: { onlyOverdue?: boolean; limit?: number } = {}): Promise<OdooActivityTask[]> {
  if (!odooConfigured()) return [];
  const domain: unknown[] = [];
  if (opts.onlyOverdue) domain.push(["date_deadline", "<", new Date().toISOString().slice(0, 10)]);
  try {
    const rows = await executeKw<ActivityRow[]>(
      "mail.activity", "search_read",
      [domain, ["id", "summary", "activity_type_id", "date_deadline", "user_id", "res_model", "res_id", "res_name"]],
      { limit: opts.limit ?? 100, order: "date_deadline asc" },
    );
    return (rows ?? []).map(mapActivity);
  } catch {
    return []; // Odoo unreachable — don't break the iCapOS task list.
  }
}

/** Mark an Odoo activity done (posts feedback + logs on the record). Returns success. */
export async function completeOdooActivity(activityId: number): Promise<boolean> {
  if (!odooConfigured() || !Number.isFinite(activityId)) return false;
  try {
    await executeKw("mail.activity", "action_feedback", [[activityId]], { feedback: "Completed from iCapOS" });
    return true;
  } catch {
    return false;
  }
}
