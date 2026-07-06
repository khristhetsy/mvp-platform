// Sales contact profile — reads the CRM mirror + annotations + linked opportunities.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/sales/activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type ContactProfile = {
  id: string; source: string; external_id: string; name: string; email: string | null; company: string | null;
  phone: string | null; phone2: string | null; website: string | null; lead_status: string | null; lead_source: string | null;
  tags: string[]; owner: string | null; membership: string | null; job_position: string | null;
  street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null; country: string | null;
  language: string | null; created_on: string | null; note: string | null;
};
export type LinkedOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; probability: number | null; status: string };

function pickRaw(raw: Record<string, unknown> | null, keys: string[]): string | null {
  if (!raw) return null;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
    // Odoo many2one fields arrive as [id, "Label"] — use the label.
    if (Array.isArray(v) && v.length === 2 && typeof v[1] === "string" && v[1].trim()) return v[1].trim();
  }
  return null;
}

// Odoo studio fields not mapped to a semantic key land in raw.__profile.extra, keyed by label.
function pickExtra(raw: Record<string, unknown> | null, labels: string[]): string | null {
  const prof = (raw?.__profile as { extra?: Record<string, unknown>; leadSource?: unknown } | undefined) ?? undefined;
  if (!prof) return null;
  for (const label of labels) {
    const v = prof.extra?.[label];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length === 2 && typeof v[1] === "string") return v[1].trim();
  }
  return null;
}

export async function getContactProfile(id: string): Promise<{ contact: ContactProfile; opportunities: LinkedOpp[] } | null> {
  // select("*") so a column-name mismatch on the mirror can never null the whole profile.
  const { data: c, error } = await db().from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("[sales/contacts] getContactProfile query failed:", error.message); return null; }
  if (!c) return null;
  const raw = (c.raw as Record<string, unknown> | null) ?? null;

  let note: string | null = null;
  const { data: ann } = await db().from("crm_contact_annotations").select("notes").eq("source", c.source).eq("external_id", c.external_id).maybeSingle();
  if (ann) note = (ann.notes as string) ?? null;

  const { data: opps } = await db().from("sales_opportunities").select("id, title, value_cents, probability, status, stage:sales_stages(name)").eq("contact_crm_id", id).order("created_at", { ascending: false });
  const opportunities: LinkedOpp[] = ((opps ?? []) as Array<Record<string, unknown>>).map((o) => ({
    id: String(o.id), title: String(o.title), stage_name: ((o.stage as { name?: string } | null)?.name) ?? null,
    value_cents: (o.value_cents as number) ?? null, probability: (o.probability as number) ?? null, status: String(o.status ?? "open"),
  }));

  const contact: ContactProfile = {
    id: String(c.id), source: c.source, external_id: c.external_id, name: c.name ?? c.email ?? "Contact",
    email: c.email ?? null, company: c.company ?? null,
    phone: c.phone ?? pickRaw(raw, ["phone"]) ?? pickRaw(raw, ["mobile"]),
    phone2: pickRaw(raw, ["mobile", "phone2", "x_studio_phone_2"]),
    website: c.website ?? pickRaw(raw, ["website"]),
    lead_status: pickExtra(raw, ["Lead Status"]) ?? pickRaw(raw, ["x_studio_lead_status"]) ?? (c.lead_status as string) ?? null,
    lead_source: ((raw?.__profile as { leadSource?: unknown } | undefined)?.leadSource as string) ?? pickExtra(raw, ["Lead Source"]) ?? pickRaw(raw, ["x_studio_lead_type"]),
    tags: Array.isArray(c.tags) ? c.tags : [], owner: c.owner ?? null,
    membership: (c.plan as string) ?? pickRaw(raw, ["membership_type", "membership"]),
    job_position: pickRaw(raw, ["function", "job_position", "title"]),
    street: pickRaw(raw, ["street"]), street2: pickRaw(raw, ["street2"]),
    city: pickRaw(raw, ["city"]), state: pickRaw(raw, ["state_id", "state"]), zip: pickRaw(raw, ["zip", "postal_code"]),
    country: pickRaw(raw, ["country_id", "country"]),
    language: pickRaw(raw, ["lang", "language"]), created_on: pickRaw(raw, ["create_date", "created_on"]) ?? (c.synced_at as string) ?? null,
    note,
  };
  return { contact, opportunities };
}

export type ContactPatch = { lead_status?: string | null; phone?: string | null; website?: string | null; owner?: string | null; tags?: string[] };

// Edit user-owned contact fields on the mirror. Note: an Odoo re-sync may overwrite these.
export async function updateContact(id: string, patch: ContactPatch, actorId?: string | null): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.lead_status !== undefined) update.lead_status = patch.lead_status || "new";
  if (patch.phone !== undefined) update.phone = patch.phone || null;
  if (patch.website !== undefined) update.website = patch.website || null;
  if (patch.owner !== undefined) update.owner = patch.owner || null;
  if (patch.tags !== undefined) update.tags = patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20);
  if (Object.keys(update).length === 0) return;
  const { error } = await db().from("crm_contacts").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  const fields = Object.keys(patch).join(", ");
  await logActivity({ kind: "contact_edit", summary: `Edited contact fields: ${fields}`, actorId, contactCrmId: id });
}

export async function appendContactNote(id: string, text: string, userId: string | null): Promise<void> {
  const { data: c } = await db().from("crm_contacts").select("source, external_id").eq("id", id).maybeSingle();
  if (!c) throw new Error("Contact not found.");
  const stamp = `[${new Date().toISOString().slice(0, 10)}] ${text.trim()}`;
  const { data: existing } = await db().from("crm_contact_annotations").select("notes").eq("source", c.source).eq("external_id", c.external_id).maybeSingle();
  const merged = existing?.notes ? `${existing.notes}\n${stamp}` : stamp;
  const { error } = await db().from("crm_contact_annotations").upsert(
    { source: c.source, external_id: c.external_id, notes: merged, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "source,external_id" },
  );
  if (error) throw new Error(error.message);
  await logActivity({ kind: "note", summary: text.trim().slice(0, 200), actorId: userId, contactCrmId: id });
}
