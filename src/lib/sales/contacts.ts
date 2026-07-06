// Sales contact profile — reads the CRM mirror + annotations + linked opportunities.
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type ContactProfile = {
  id: string; source: string; external_id: string; name: string; email: string | null; company: string | null;
  phone: string | null; website: string | null; lead_status: string | null; tags: string[]; owner: string | null;
  membership: string | null; job_position: string | null; city: string | null; state: string | null; country: string | null;
  language: string | null; created_on: string | null; note: string | null;
};
export type LinkedOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; probability: number | null; status: string };

function pickRaw(raw: Record<string, unknown> | null, keys: string[]): string | null {
  if (!raw) return null;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function getContactProfile(id: string): Promise<{ contact: ContactProfile; opportunities: LinkedOpp[] } | null> {
  const { data: c } = await db().from("crm_contacts").select("id, source, external_id, name, email, company, phone, website, lead_status, tags, owner, plan, raw, synced_at").eq("id", id).maybeSingle();
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
    email: c.email ?? null, company: c.company ?? null, phone: c.phone ?? null, website: c.website ?? null,
    lead_status: c.lead_status ?? null, tags: Array.isArray(c.tags) ? c.tags : [], owner: c.owner ?? null,
    membership: (c.plan as string) ?? pickRaw(raw, ["membership_type", "membership"]),
    job_position: pickRaw(raw, ["function", "job_position", "title"]),
    city: pickRaw(raw, ["city"]), state: pickRaw(raw, ["state_id", "state"]), country: pickRaw(raw, ["country_id", "country"]),
    language: pickRaw(raw, ["lang", "language"]), created_on: pickRaw(raw, ["create_date", "created_on"]) ?? (c.synced_at as string) ?? null,
    note,
  };
  return { contact, opportunities };
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
}
