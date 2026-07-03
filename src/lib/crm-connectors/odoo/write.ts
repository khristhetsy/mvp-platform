// Odoo write-back. Deliberately narrow: an allowlist of editable res.partner
// fields, and "delete" = archive (active=false, reversible) — never a hard
// unlink. All calls go through executeKw with the configured credentials.

import { executeKw } from "@/lib/crm-connectors/odoo/client";

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

/** Archive (soft-delete) the contact in Odoo. Reversible from Odoo. */
export async function archivePartner(externalId: string): Promise<void> {
  const id = partnerId(externalId);
  const ok = await executeKw<boolean>("res.partner", "write", [[id], { active: false }]);
  if (!ok) throw new Error("Odoo rejected the archive.");
}
