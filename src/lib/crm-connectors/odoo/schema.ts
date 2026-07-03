// Editable-field schema for the full profile editor. Uses Odoo fields_get to
// learn each field's type/label/options, and loads option lists for relation
// fields. Cached for the process lifetime. Only non-readonly, stored fields of
// a supported control type are exposed — that set is the write allowlist.

import { executeKw } from "@/lib/crm-connectors/odoo/client";
import { loadStudioFields } from "@/lib/crm-connectors/odoo/adapter";

const CORE_FIELDS = ["name", "function", "email", "phone", "mobile", "website", "city", "comment"];

export type FieldControl = "text" | "textarea" | "select" | "multiselect" | "checkbox" | "number" | "date" | "datetime";

export interface EditableFieldDesc {
  name: string;
  label: string;
  control: FieldControl;
  relation?: string;
  options?: { value: string; label: string }[];
}

type FieldMeta = { string?: string; type?: string; selection?: [string, string][]; relation?: string; readonly?: boolean; store?: boolean };

function controlFor(type: string): FieldControl | null {
  switch (type) {
    case "char": return "text";
    case "text": case "html": return "textarea";
    case "selection": return "select";
    case "many2one": return "select";
    case "many2many": return "multiselect";
    case "boolean": return "checkbox";
    case "integer": case "float": case "monetary": return "number";
    case "date": return "date";
    case "datetime": return "datetime";
    default: return null;
  }
}

let schemaCache: EditableFieldDesc[] | null = null;

export async function getEditableSchema(): Promise<EditableFieldDesc[]> {
  if (schemaCache) return schemaCache;
  const studio = await loadStudioFields();
  const names = [...new Set([...CORE_FIELDS, ...studio.map((s) => s.name)])];

  const meta = await executeKw<Record<string, FieldMeta>>(
    "res.partner", "fields_get", [names],
    { attributes: ["string", "type", "selection", "relation", "readonly", "store"] },
  );

  // Load option lists for relation fields (many2one / many2many).
  const relations = new Set<string>();
  for (const n of names) {
    const m = meta[n];
    if (m && (m.type === "many2one" || m.type === "many2many") && m.relation) relations.add(m.relation);
  }
  const relOptions = new Map<string, { value: string; label: string }[]>();
  await Promise.all([...relations].map(async (rel) => {
    try {
      const rows = await executeKw<{ id: number; display_name?: string }[]>(
        rel, "search_read", [[], ["display_name"]], { limit: 500, order: "display_name asc" },
      );
      relOptions.set(rel, rows.map((r) => ({ value: String(r.id), label: r.display_name || String(r.id) })));
    } catch {
      relOptions.set(rel, []);
    }
  }));

  const out: EditableFieldDesc[] = [];
  for (const n of names) {
    const m = meta[n];
    if (!m || m.readonly || m.store === false) continue;
    const control = controlFor(String(m.type || ""));
    if (!control) continue;
    const desc: EditableFieldDesc = { name: n, label: String(m.string || n), control };
    if (m.type === "selection") desc.options = (m.selection || []).map(([v, l]) => ({ value: String(v), label: String(l) }));
    if (m.type === "many2one" || m.type === "many2many") {
      desc.relation = m.relation;
      desc.options = relOptions.get(m.relation || "") || [];
    }
    out.push(desc);
  }
  schemaCache = out;
  return out;
}

/** Current values for a contact, normalized for the client form. */
export async function readPartnerValues(externalId: string, schema: EditableFieldDesc[]): Promise<Record<string, unknown>> {
  const id = Number(externalId);
  if (!Number.isInteger(id) || id <= 0) return {};
  const names = schema.map((s) => s.name);
  const rows = await executeKw<Record<string, unknown>[]>("res.partner", "read", [[id], names]);
  const raw = rows?.[0] ?? {};
  const out: Record<string, unknown> = {};
  for (const f of schema) {
    const v = raw[f.name];
    if (f.control === "multiselect") out[f.name] = Array.isArray(v) ? (v as number[]).map(String) : [];
    else if (f.control === "select" && f.relation) out[f.name] = Array.isArray(v) ? String((v as unknown[])[0]) : "";
    else if (f.control === "checkbox") out[f.name] = Boolean(v);
    else out[f.name] = v === false || v == null ? "" : v;
  }
  return out;
}
