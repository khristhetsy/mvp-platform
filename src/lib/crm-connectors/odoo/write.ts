// Odoo write-back. Deliberately narrow: an allowlist of editable res.partner
// fields, and "delete" = archive (active=false, reversible) — never a hard
// unlink. All calls go through executeKw with the configured credentials.

import { executeKw } from "@/lib/crm-connectors/odoo/client";
import type { EditableFieldDesc } from "@/lib/crm-connectors/odoo/schema";

// UI field key → Odoo field name. Anything not here cannot be written.
const FIELD_MAP: Record<string, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  title: "function", // job title
  website: "website",
  city: "city",
};

export type EditableField = keyof typeof FIELD_MAP;

function partnerId(externalId: string): number {
  const id = Number(externalId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid Odoo contact id.");
  return id;
}

/** Write the allowlisted fields back to Odoo. Returns the Odoo fields written. */
export async function updatePartner(
  externalId: string,
  input: Partial<Record<EditableField, string | null>>,
): Promise<Record<string, string | false>> {
  const id = partnerId(externalId);
  const fields: Record<string, string | false> = {};
  for (const [k, v] of Object.entries(input)) {
    const odooField = FIELD_MAP[k as EditableField];
    if (odooField) fields[odooField] = v && v.trim() !== "" ? v.trim() : false;
  }
  if (Object.keys(fields).length === 0) return {};
  const ok = await executeKw<boolean>("res.partner", "write", [[id], fields]);
  if (!ok) throw new Error("Odoo rejected the update.");
  return fields;
}

/**
 * Write an arbitrary set of allowlisted fields back to Odoo, typed by the
 * schema. The schema IS the allowlist — anything not in it is ignored. Handles
 * many2many command tuples, many2one ids, selection keys, booleans, numbers.
 */
export async function updatePartnerProfile(
  externalId: string,
  values: Record<string, unknown>,
  schema: EditableFieldDesc[],
): Promise<void> {
  const id = partnerId(externalId);
  const byName = new Map(schema.map((s) => [s.name, s]));
  const payload: Record<string, unknown> = {};

  for (const [name, val] of Object.entries(values)) {
    const desc = byName.get(name);
    if (!desc) continue; // not in the allowlist
    switch (desc.control) {
      case "multiselect": {
        const ids = Array.isArray(val) ? val.map((x) => Number(x)).filter((n) => Number.isInteger(n)) : [];
        payload[name] = [[6, 0, ids]]; // replace the full set
        break;
      }
      case "select": {
        if (desc.relation) {
          const idv = val === "" || val == null ? false : Number(val);
          payload[name] = typeof idv === "number" && Number.isInteger(idv) ? idv : false;
        } else {
          payload[name] = val === "" || val == null ? false : String(val);
        }
        break;
      }
      case "checkbox":
        payload[name] = Boolean(val);
        break;
      case "number":
        payload[name] = val === "" || val == null ? false : Number(val);
        break;
      default:
        payload[name] = val === "" || val == null ? false : String(val);
    }
  }

  if (Object.keys(payload).length === 0) return;
  const ok = await executeKw<boolean>("res.partner", "write", [[id], payload]);
  if (!ok) throw new Error("Odoo rejected the update.");
}

/** Archive (soft-delete) the contact in Odoo. Reversible from Odoo. */
export async function archivePartner(externalId: string): Promise<void> {
  const id = partnerId(externalId);
  const ok = await executeKw<boolean>("res.partner", "write", [[id], { active: false }]);
  if (!ok) throw new Error("Odoo rejected the archive.");
}
