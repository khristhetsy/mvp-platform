/**
 * The Odoo project stage bar for an Investor Relations project — server only.
 *
 * Mirrors the two status bars on the Odoo project form (Deals2Match):
 *   - Stage: project.project.stage_id, every project stage in sequence order,
 *     time in each stage from duration_tracking ("14d" like Odoo).
 *   - Status: the project's second status bar (a custom selection or many2one
 *     field whose label contains "Status", e.g. First Status / Second Status).
 *     ODOO_IR_PROJECT_STATUS_FIELD overrides the field name when set.
 *
 * Clicking a step writes the new value to Odoo, the same as clicking it in Odoo.
 * This is the only write the IR module makes to Odoo; everything else stays read only.
 */
import "server-only";

import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";
import { db } from "@/lib/ir/db";
export { durationLabel } from "@/lib/ir/odoo-stage-format";

type Many2one = [number, string] | false;

export type OdooBarStep = { key: string; label: string; folded: boolean; seconds: number | null };
export type OdooBar = { field: string; label: string; steps: OdooBarStep[]; current: string | null };
export type OdooProjectStage = {
  /** The Odoo projects linked to this IR project (most recent first). */
  projects: Array<{ id: number; name: string }>;
  projectId: number;
  stage: OdooBar | null;
  status: OdooBar | null;
};

type FieldMeta = { string: string; type: string; relation?: string; selection?: Array<[string, string]>; readonly?: boolean };

let metaCache: { at: number; fields: Record<string, FieldMeta> } | null = null;
async function projectFields(): Promise<Record<string, FieldMeta>> {
  if (metaCache && Date.now() - metaCache.at < 10 * 60 * 1000) return metaCache.fields;
  const fields = await executeKw<Record<string, FieldMeta>>("project.project", "fields_get", [], {
    attributes: ["string", "type", "relation", "selection", "readonly"],
  });
  metaCache = { at: Date.now(), fields };
  return fields;
}

/** The second status bar's field: env override, else a custom field labelled "...Status". */
export function pickStatusField(fields: Record<string, FieldMeta>): string | null {
  const override = process.env.ODOO_IR_PROJECT_STATUS_FIELD?.trim();
  if (override && fields[override]) return override;
  const candidates = Object.entries(fields).filter(
    ([name, f]) => name.startsWith("x_") && (f.type === "selection" || f.type === "many2one") && /status/i.test(f.string),
  );
  return candidates[0]?.[0] ?? null;
}

async function linkedOdooProjects(irProjectId: string): Promise<Array<{ id: number; name: string }>> {
  const { data } = await db().from("ir_projects").select("odoo_project_ids").eq("id", irProjectId).maybeSingle();
  const ids = ((data as { odoo_project_ids?: number[] | null } | null)?.odoo_project_ids ?? []).filter((n) => Number.isFinite(n));
  if (!ids.length) return [];
  const rows = await executeKw<Array<{ id: number; name: string }>>("project.project", "read", [ids, ["name"]], { context: { active_test: false } });
  return rows.sort((a, b) => b.id - a.id).map((r) => ({ id: r.id, name: r.name }));
}

export async function loadOdooProjectStage(irProjectId: string, odooProjectId?: number | null): Promise<OdooProjectStage | null> {
  if (!odooConfigured()) return null;
  const projects = await linkedOdooProjects(irProjectId);
  if (!projects.length) return null;
  const projectId = odooProjectId && projects.some((p) => p.id === odooProjectId) ? odooProjectId : projects[0].id;

  const fields = await projectFields();
  const statusField = pickStatusField(fields);
  const readFields = ["stage_id", ...(fields.duration_tracking ? ["duration_tracking"] : []), ...(statusField ? [statusField] : [])];
  const [row] = await executeKw<Array<Record<string, unknown>>>("project.project", "read", [[projectId], readFields], { context: { active_test: false } });
  if (!row) return null;

  // Stage bar: every project stage, like Odoo's statusbar.
  let stage: OdooBar | null = null;
  if (fields.stage_id) {
    const stages = await executeKw<Array<{ id: number; name: string; sequence: number; fold?: boolean }>>(
      "project.project.stage", "search_read", [[]], { fields: ["name", "sequence", "fold"], order: "sequence asc, id asc" },
    );
    const durations = (row.duration_tracking && typeof row.duration_tracking === "object" ? row.duration_tracking : {}) as Record<string, number>;
    const cur = row.stage_id as Many2one;
    stage = {
      field: "stage_id",
      label: fields.stage_id.string || "Stage",
      current: cur ? String(cur[0]) : null,
      steps: stages.map((s) => ({ key: String(s.id), label: s.name, folded: Boolean(s.fold), seconds: durations[String(s.id)] ?? null })),
    };
  }

  // Status bar: the custom "...Status" field.
  let status: OdooBar | null = null;
  if (statusField) {
    const meta = fields[statusField];
    if (meta.type === "selection") {
      const v = row[statusField];
      status = {
        field: statusField,
        label: meta.string,
        current: typeof v === "string" ? v : null,
        steps: (meta.selection ?? []).map(([key, label]) => ({ key, label, folded: false, seconds: null })),
      };
    } else if (meta.type === "many2one" && meta.relation) {
      const opts = await executeKw<Array<{ id: number; display_name: string }>>(meta.relation, "search_read", [[]], { fields: ["display_name"], limit: 50 });
      const v = row[statusField] as Many2one;
      status = {
        field: statusField,
        label: meta.string,
        current: v ? String(v[0]) : null,
        steps: opts.map((o) => ({ key: String(o.id), label: o.display_name, folded: false, seconds: null })),
      };
    }
  }

  return { projects, projectId, stage, status };
}

/** Move the Odoo project to a stage or status value, like clicking it in Odoo. */
export async function setOdooProjectStage(
  irProjectId: string,
  odooProjectId: number,
  field: string,
  value: string,
): Promise<void> {
  const projects = await linkedOdooProjects(irProjectId);
  if (!projects.some((p) => p.id === odooProjectId)) throw new Error("That Odoo project isn't linked to this project.");
  const fields = await projectFields();
  const allowed = field === "stage_id" || field === pickStatusField(fields);
  if (!allowed || !fields[field]) throw new Error("That field can't be changed here.");
  const meta = fields[field];
  const written = meta.type === "many2one" ? Number(value) : value;
  if (meta.type === "many2one" && !Number.isFinite(written)) throw new Error("Unknown stage.");
  await executeKw("project.project", "write", [[odooProjectId], { [field]: written }]);
}
