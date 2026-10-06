/**
 * Autosaving, field-by-field contact edits for the IR "Open: Contact" window.
 *
 * One field per save. Every save:
 *   1. writes iCapOS through updateContact (the Sales Hub path: overrides or columns,
 *      then re-scores matching),
 *   2. marks a filled or guessed value as confirmed: its provenance tag is removed, and the
 *      key is dropped from the contacts fill's undo lists so undoing a fill step can never
 *      delete a value a person has now stated,
 *   3. pushes the value to Odoo when the contact is linked and the editor is an admin
 *      (analysts are read-only on Odoo, as everywhere else). An Odoo failure never undoes
 *      the iCapOS save; it is reported so the screen can say so,
 *   4. logs the before and after values, which is what History and Undo read.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getContactProfile, updateContact, type ContactPatch, type ContactProfile } from "@/lib/sales/contacts";
import { mergeOverrides } from "@/lib/sales/overrides";
import { logActivity } from "@/lib/sales/activity";
import { FIELDS as FILL_FIELDS } from "@/lib/contacts/fill-missing";
import { OP_STAGE_LABELS } from "@/lib/fit/options";
import { INVESTOR_PROFILE_LABEL, isInvestorProfileLabel } from "@/lib/sales/investor-profile";
import { updatePartner, updatePartnerProfile } from "@/lib/crm-connectors/odoo/write";
import { getEditableSchema, type EditableFieldDesc } from "@/lib/crm-connectors/odoo/schema";
import { fetchAndMapPartner } from "@/lib/crm-connectors/odoo/adapter";
import { upsertContacts } from "@/lib/crm-connectors/mirror";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Contact fields with their own place in iCapOS (a column or a string override). */
export const COLUMN_FIELDS = [
  "name", "company", "membership", "job_position", "phone", "phone2", "email", "website",
  "street", "street2", "city", "state", "zip", "country",
] as const;
export type ColumnField = (typeof COLUMN_FIELDS)[number];
export function isColumnField(k: string): k is ColumnField {
  return (COLUMN_FIELDS as readonly string[]).includes(k);
}

/** Which Odoo res.partner field a column field writes (via updatePartner). */
const ODOO_COLUMN: Partial<Record<ColumnField, "name" | "email" | "phone" | "title" | "website" | "city">> = {
  name: "name", email: "email", phone: "phone", job_position: "title", website: "website", city: "city",
};

/**
 * Provenance keys that can mark a field as filled rather than stated, by the key the
 * editor saves under. More than one key can apply (stage has a founder and an investor
 * phrasing), so every listed key is cleared on a human edit. Pure.
 */
export function sourceKeysFor(key: string): string[] {
  const out = new Set<string>();
  if (key === "website") out.add("_website_source");
  if (key === "country") out.add("_country_source");
  if (key === "state") out.add("_state_source");
  if (key === "company") out.add("_company_source");
  if (key === "Industries") out.add("_industry_source");
  if (key === "Bio") out.add("_bio_source");
  if (isInvestorProfileLabel(key) || key === INVESTOR_PROFILE_LABEL) out.add("_type_source");
  if ((OP_STAGE_LABELS as readonly string[]).includes(key)) { out.add("_stage_source"); out.add("_operating_stage_source"); }
  const fixed: Record<string, string> = {
    "Investor investment size?": "_size_source",
    "Investor preferences for the company with an annual revenue range of?": "_revenue_source",
    "Investor preferences for company with annual EBITDA range of?": "_ebitda_source",
    "Investor preferences for company with annual EBITDA range of? ": "_ebitda_source",
    "Entrepreneur funding stage?": "_funding_stage_source",
  };
  if (fixed[key]) out.add(fixed[key]);
  for (const role of ["founder", "investor"] as const) {
    for (const f of FILL_FIELDS[role]) if (f.key === key) out.add(f.sourceKey);
  }
  return [...out];
}

/** Tag shown next to a field, if any of its provenance keys is set. Pure. */
export function tagFor(overrides: Record<string, unknown> | null | undefined, key: string): string | null {
  for (const k of sourceKeysFor(key)) {
    const v = overrides?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/** A human confirmation or edit: clear the tags and pull the key out of fill undo lists. Pure. */
export function confirmPatch(overrides: Record<string, unknown> | null | undefined, key: string): { set: Record<string, unknown>; remove: string[] } {
  const tags = sourceKeysFor(key);
  const remove = tags.filter((k) => overrides?.[k] != null);
  const set: Record<string, unknown> = {};
  const drop = new Set([key, ...tags]);
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (!k.startsWith("_cfill_") || !Array.isArray(v)) continue;
    const kept = v.filter((x) => !drop.has(String(x)));
    if (kept.length !== v.length) set[k] = kept;
  }
  return { set, remove };
}

/* ------------------------------------------------------------------ reading */

export type EditorData = {
  contact: ContactProfile;
  /** Provenance tag per editable key (column field or profile saveKey), when filled. */
  tags: Record<string, string>;
  odoo: { linked: boolean; canWrite: boolean };
};

export async function loadEditor(id: string, isAdmin: boolean): Promise<EditorData | null> {
  const data = await getContactProfile(id);
  if (!data) return null;
  const { data: row } = await db().from("crm_contacts").select("source, external_id, overrides").eq("id", id).maybeSingle();
  const ov = (row?.overrides ?? {}) as Record<string, unknown>;
  const tags: Record<string, string> = {};
  const keys = [...COLUMN_FIELDS, ...data.contact.extra.map((e) => e.label), INVESTOR_PROFILE_LABEL,
    ...FILL_FIELDS.founder.map((f) => f.key), ...FILL_FIELDS.investor.map((f) => f.key)];
  for (const k of keys) {
    const t = tagFor(ov, k);
    if (t) tags[k] = t;
  }
  const linked = row?.source === "odoo" && Boolean(row?.external_id);
  return { contact: data.contact, tags, odoo: { linked, canWrite: linked && isAdmin } };
}

/* ------------------------------------------------------------------ Odoo */

let schemaCache: { at: number; schema: EditableFieldDesc[] } | null = null;
async function odooSchema(): Promise<EditableFieldDesc[]> {
  if (schemaCache && Date.now() - schemaCache.at < 10 * 60 * 1000) return schemaCache.schema;
  const schema = await getEditableSchema();
  schemaCache = { at: Date.now(), schema };
  return schema;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Odoo field labels that hold a profile key whose iCapOS label differs. */
const ODOO_ALIASES: Record<string, string[]> = {
  industries: ["investor interested in type(s) of business industries?", "entrepreneur type of industries?"],
  "investor profile": ["investor profile?", "investor profile", "investor type?", "investor type"],
};

/** The Odoo field for a profile key, preferring the side (investor/founder) the contact is on. Pure. */
export function odooFieldFor(schema: EditableFieldDesc[], key: string, membership: string | null): EditableFieldDesc | null {
  const want = [norm(key), ...(ODOO_ALIASES[norm(isInvestorProfileLabel(key) ? INVESTOR_PROFILE_LABEL : key)] ?? [])];
  const hits = schema.filter((f) => want.includes(norm(f.label)));
  if (hits.length <= 1) return hits[0] ?? null;
  const side = /entrepreneur|founder/i.test(membership ?? "") ? "entrepreneur" : "investor";
  return hits.find((f) => norm(f.label).startsWith(side)) ?? hits[0];
}

/** Turn iCapOS values into what Odoo stores for that field, or explain why not. Pure. */
export function odooValue(desc: EditableFieldDesc, values: string[]): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (desc.control === "multiselect" || desc.control === "select") {
    const opts = desc.options ?? [];
    const ids: string[] = [];
    for (const v of values) {
      const hit = opts.find((o) => norm(o.label) === norm(v)) ?? opts.find((o) => norm(o.value) === norm(v));
      if (!hit) return { ok: false, reason: `"${v}" is not an option in Odoo` };
      ids.push(hit.value);
    }
    if (desc.control === "select") {
      if (ids.length > 1) return { ok: false, reason: "Odoo takes one value here" };
      return { ok: true, value: ids[0] ?? "" };
    }
    return { ok: true, value: ids };
  }
  if (desc.control === "checkbox") return { ok: true, value: values.some((v) => /^(yes|true|1)$/i.test(v)) };
  if (desc.control === "number") return values[0] && !Number.isNaN(Number(values[0])) ? { ok: true, value: Number(values[0]) } : values.length ? { ok: false, reason: "Odoo needs a number here" } : { ok: true, value: "" };
  if (desc.control === "date" || desc.control === "datetime") return { ok: false, reason: "dates are edited in Odoo" };
  return { ok: true, value: values.join(", ") };
}

export type OdooResult = { status: "saved" | "skipped" | "failed"; message?: string };

async function pushToOdoo(externalId: string, key: string, values: string[], membership: string | null): Promise<OdooResult> {
  try {
    if (isColumnField(key)) {
      const field = ODOO_COLUMN[key];
      if (!field) return { status: "skipped", message: "This field is kept in iCapOS only." };
      await updatePartner(externalId, { [field]: values[0] ?? null });
    } else {
      const schema = await odooSchema();
      const desc = odooFieldFor(schema, key, membership);
      if (!desc) return { status: "skipped", message: "Odoo has no matching field." };
      const v = odooValue(desc, values);
      if (!v.ok) return { status: "skipped", message: `Not sent to Odoo: ${v.reason}.` };
      await updatePartnerProfile(externalId, { [desc.name]: v.value }, schema);
    }
    // Refresh the synced copy so the Odoo record and iCapOS agree.
    const fresh = await fetchAndMapPartner(externalId).catch(() => null);
    if (fresh) await upsertContacts([fresh]).catch(() => {});
    return { status: "saved" };
  } catch (e) {
    return { status: "failed", message: e instanceof Error ? e.message.slice(0, 200) : "Odoo rejected the update." };
  }
}

/* ------------------------------------------------------------------ writing */

function currentValues(c: ContactProfile, key: string): string[] {
  if (isColumnField(key)) {
    const v = (c as unknown as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? [v.trim()] : [];
  }
  const label = isInvestorProfileLabel(key) ? INVESTOR_PROFILE_LABEL : key;
  return c.extra.find((e) => norm(e.label) === norm(label))?.values ?? [];
}

export type SaveInput = {
  key: string;
  values: string[];
  /** Undo of a confirm or of an edit to a filled value: put this tag back. */
  restoreTag?: { sourceKey: string; tag: string } | null;
};
export type SaveResult = { before: string[]; after: string[]; tagBefore: { sourceKey: string; tag: string } | null; odoo: OdooResult };

export async function saveField(id: string, input: SaveInput, actor: { id: string; isAdmin: boolean }): Promise<SaveResult> {
  const data = await getContactProfile(id);
  if (!data) throw new Error("Contact not found.");
  const c = data.contact;
  const key = input.key;
  const values = input.values.map((v) => v.trim()).filter(Boolean);
  const before = currentValues(c, key);

  const patch: ContactPatch = isColumnField(key)
    ? ({ [key]: values[0] ?? null } as ContactPatch)
    : { preferences: { [key]: values } };
  if (isColumnField(key) && key === "name" && !values[0]) throw new Error("A contact needs a name.");
  await updateContact(id, patch, actor.id);

  const { data: row } = await db().from("crm_contacts").select("source, external_id, overrides").eq("id", id).maybeSingle();
  const ov = (row?.overrides ?? {}) as Record<string, unknown>;
  const tagKey = sourceKeysFor(key).find((k) => typeof ov[k] === "string") ?? null;
  const tagBefore = tagKey ? { sourceKey: tagKey, tag: String(ov[tagKey]) } : null;
  const conf = confirmPatch(ov, key);
  if (input.restoreTag) {
    conf.set[input.restoreTag.sourceKey] = input.restoreTag.tag;
    conf.remove = conf.remove.filter((k) => k !== input.restoreTag!.sourceKey);
  }
  if (Object.keys(conf.set).length || conf.remove.length) await mergeOverrides(id, conf, "inline edit: provenance");

  const odoo: OdooResult = row?.source === "odoo" && row.external_id
    ? (actor.isAdmin ? await pushToOdoo(String(row.external_id), key, values, c.membership) : { status: "skipped", message: "Saved in iCapOS. Only admins can update Odoo." })
    : { status: "skipped", message: "Not linked to Odoo." };

  await logActivity({
    kind: "contact_edit", actorId: actor.id, contactCrmId: id,
    summary: `Edited ${key}`,
    meta: { field: key, before, after: values, odoo: odoo.status, via: "contact_window" },
  });
  return { before, after: values, tagBefore, odoo };
}

/** Confirm a filled value without changing it. Returns the tag so Undo can restore it. */
export async function confirmField(id: string, key: string, actorId: string): Promise<{ sourceKey: string; tag: string } | null> {
  const { data: row } = await db().from("crm_contacts").select("overrides").eq("id", id).maybeSingle();
  const ov = (row?.overrides ?? {}) as Record<string, unknown>;
  const tagKey = sourceKeysFor(key).find((k) => typeof ov[k] === "string") ?? null;
  const conf = confirmPatch(ov, key);
  if (Object.keys(conf.set).length || conf.remove.length) {
    const merged = await mergeOverrides(id, conf, "inline edit: confirm");
    if (merged === null) throw new Error("Couldn't confirm.");
  }
  if (tagKey) await logActivity({ kind: "contact_edit", actorId, contactCrmId: id, summary: `Confirmed ${key}`, meta: { field: key, confirmed: String(ov[tagKey]), via: "contact_window" } });
  return tagKey ? { sourceKey: tagKey, tag: String(ov[tagKey]) } : null;
}

/** Put a tag back (Undo of a confirm). */
export async function restoreTag(id: string, t: { sourceKey: string; tag: string }): Promise<void> {
  if (!/^_[a-z_]+_source$/.test(t.sourceKey)) throw new Error("Invalid tag.");
  const merged = await mergeOverrides(id, { set: { [t.sourceKey]: t.tag } }, "inline edit: restore tag");
  if (merged === null) throw new Error("Couldn't undo.");
}

export type HistoryEntry = { id: string; at: string; actor: string | null; field: string; before: string[] | null; after: string[] | null; confirmed: string | null; odoo: string | null };

/** Recent field edits from the contact window, newest first. */
export async function editHistory(id: string, limit = 50): Promise<HistoryEntry[]> {
  const { data } = await db().from("sales_activity_log").select("id, created_at, actor_id, meta")
    .eq("contact_crm_id", id).eq("kind", "contact_edit").not("meta->field", "is", null)
    .order("created_at", { ascending: false }).limit(limit);
  const rows = (data ?? []) as Array<{ id: string; created_at: string; actor_id: string | null; meta: Record<string, unknown> }>;
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await db().from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (ps ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name ?? p.email ?? "Staff");
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : null);
  return rows.map((r) => ({
    id: r.id, at: r.created_at, actor: r.actor_id ? names.get(r.actor_id) ?? null : null,
    field: String(r.meta.field), before: list(r.meta.before), after: list(r.meta.after),
    confirmed: typeof r.meta.confirmed === "string" ? r.meta.confirmed : null,
    odoo: typeof r.meta.odoo === "string" ? r.meta.odoo : null,
  }));
}
