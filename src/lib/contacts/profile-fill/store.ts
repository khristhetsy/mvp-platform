/**
 * LinkedIn contact profile fill (server): load proposals, list the review queue, and
 * write accepted values onto the contact through the same editor the contact window
 * uses (saveField), so Odoo push, provenance and the edit log all behave as usual.
 *
 * Nothing reaches a contact until a person accepts it.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { parseCsvCells, splitHeader } from "@/lib/contacts/field-mapping";
import { linkedinSlug, phoneKey } from "@/lib/contacts/linkedin-import";
import { getContactProfile } from "@/lib/sales/contacts";
import { mergeOverrides } from "@/lib/sales/overrides";
import { logActivity } from "@/lib/sales/activity";
import { saveField } from "@/lib/contacts/inline-edit";
import { loadVocabularies } from "@/lib/vocabulary/store";
import {
  FIELD_SPECS,
  companyKeyOf,
  companySummaryFromRow,
  fieldSpec,
  suggestionsFromFoundRow,
  suggestionsFromResearchRow,
  type FillField,
  type FillLabel,
  type Suggestion,
  type Vocab,
} from "@/lib/contacts/profile-fill/fields";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type LoadKind = "research" | "found";
export type LoadResult = { rows: number; matched: number; unmatched: number; proposals: number; companies: number; alreadyThere: number };

type ContactLite = {
  id: string; linkedin_slug: string | null; email: string | null; phone: string | null;
  website: string | null; company: string | null; overrides: Record<string, unknown> | null;
};

async function vocabMaps(): Promise<Partial<Record<"investor_type" | "industry" | "funding_stage" | "money_band" | "geography", Vocab>>> {
  const all = await loadVocabularies();
  const map = (list: keyof typeof all) => {
    const m: Vocab = new Map();
    for (const o of all[list] ?? []) { m.set(o.slug.toLowerCase(), o.label); m.set(o.label.toLowerCase(), o.label); }
    return m;
  };
  return { investor_type: map("investor_type"), industry: map("industry"), funding_stage: map("funding_stage"), money_band: map("money_band"), geography: map("geography") };
}

const host = (u: string | null | undefined) => (u ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

/** True when the contact already holds this value, so proposing it again is noise. */
function alreadyHas(c: ContactLite, s: Suggestion): boolean {
  const ov = c.overrides ?? {};
  if (s.field === "email") {
    const v = String(s.value).toLowerCase();
    return v === (c.email ?? "").toLowerCase() || v === String(ov.email2 ?? "").toLowerCase();
  }
  if (s.field === "phone") {
    const k = phoneKey(String(s.value));
    return Boolean(k) && (k === phoneKey(c.phone) || k === phoneKey(String(ov.phone2 ?? "")));
  }
  if (s.field === "website") return Boolean(c.website) && host(c.website) === host(String(s.value));
  return false;
}

/** Match a file's rows to contacts by LinkedIn profile, then store proposals. */
export async function loadFile(text: string, kind: LoadKind): Promise<LoadResult> {
  const { columns, rows } = splitHeader(parseCsvCells(text));
  const records = rows.map((cells) => Object.fromEntries(columns.map((c, i) => [c.trim(), (cells[i] ?? "").trim()])));
  const result: LoadResult = { rows: records.length, matched: 0, unmatched: 0, proposals: 0, companies: 0, alreadyThere: 0 };
  if (!columns.includes("LinkedIn URL")) throw new Error("This file has no LinkedIn URL column.");

  const bySlug = new Map<string, Record<string, string>>();
  for (const r of records) { const s = linkedinSlug(r["LinkedIn URL"]); if (s) bySlug.set(s, r); }
  const slugs = [...bySlug.keys()];

  const contacts: ContactLite[] = [];
  for (let i = 0; i < slugs.length; i += 300) {
    const { data, error } = await db().from("crm_contacts")
      .select("id, linkedin_slug, email, phone, website, company, overrides")
      .in("linkedin_slug", slugs.slice(i, i + 300));
    if (error) throw new Error(error.message);
    contacts.push(...((data ?? []) as ContactLite[]));
  }
  const contactBySlug = new Map<string, ContactLite>();
  for (const c of contacts) if (c.linkedin_slug && !contactBySlug.has(c.linkedin_slug)) contactBySlug.set(c.linkedin_slug, c);
  result.matched = [...bySlug.keys()].filter((s) => contactBySlug.has(s)).length;
  result.unmatched = records.length - result.matched;

  const vocab = kind === "research" ? await vocabMaps() : {};
  const inserts: Record<string, unknown>[] = [];
  const summaries = new Map<string, Record<string, unknown>>();

  for (const [slug, row] of bySlug) {
    const c = contactBySlug.get(slug);
    if (!c) continue;
    const proposals = kind === "research" ? suggestionsFromResearchRow(row, vocab) : suggestionsFromFoundRow(row);
    if (kind === "research") {
      const cs = companySummaryFromRow(row);
      if (cs) {
        const key = companyKeyOf(cs.company);
        summaries.set(key, { company_key: key, company: cs.company, summary: cs.summary, website: cs.website, hq_city: cs.hqCity, source_url: cs.website, updated_at: new Date().toISOString() });
        proposals.push({ field: "company_summary", value: cs.summary, label: "found", sourceUrl: cs.website, basis: "Written from the firm's published pages", confidence: row["Confidence"] || null });
      }
    }
    for (const s of proposals) {
      if (alreadyHas(c, s)) { result.alreadyThere += 1; continue; }
      inserts.push({ contact_id: c.id, field: s.field, value: s.value, label: s.label, source_url: s.sourceUrl, basis: s.basis, confidence: s.confidence, origin: kind });
    }
  }

  // A newer proposal replaces a pending one for the same field; decided ones are kept.
  for (let i = 0; i < inserts.length; i += 500) {
    const part = inserts.slice(i, i + 500);
    const ids = [...new Set(part.map((x) => x.contact_id as string))];
    const fields = [...new Set(part.map((x) => x.field as string))];
    await db().from("contact_fill_suggestions").delete().eq("status", "pending").in("contact_id", ids).in("field", fields);
    const { error } = await db().from("contact_fill_suggestions").insert(part);
    if (error) throw new Error(error.message);
  }
  result.proposals = inserts.length;

  // Shared company summaries: never overwrite one a person approved.
  if (summaries.size) {
    const keys = [...summaries.keys()];
    const approved = new Set<string>();
    for (let i = 0; i < keys.length; i += 300) {
      const { data } = await db().from("company_summaries").select("company_key").eq("status", "approved").in("company_key", keys.slice(i, i + 300));
      for (const r of (data ?? []) as Array<{ company_key: string }>) approved.add(r.company_key);
    }
    const rowsUp = [...summaries.values()].filter((r) => !approved.has(String(r.company_key)));
    for (let i = 0; i < rowsUp.length; i += 500) {
      const { error } = await db().from("company_summaries").upsert(rowsUp.slice(i, i + 500), { onConflict: "company_key" });
      if (error) throw new Error(error.message);
    }
    result.companies = rowsUp.length;
  }
  return result;
}

export type QueueGroup = "all" | "investor" | "other";

export async function reviewQueue(group: QueueGroup): Promise<Array<{ contactId: string; pending: number }>> {
  const { data, error } = await db().rpc("profile_fill_queue", { p_group: group });
  if (error) throw new Error(error.message.includes("profile_fill_queue") ? "The profile fill migration hasn't been run yet." : error.message);
  return ((data ?? []) as Array<{ contact_id: string; pending: number }>).map((r) => ({ contactId: r.contact_id, pending: r.pending }));
}

export type ReviewRow = {
  id: string;
  field: FillField;
  fieldLabel: string;
  value: string | string[];
  label: FillLabel;
  sourceUrl: string | null;
  basis: string | null;
  confidence: string | null;
  current: string | null;
  /** For email and phone: where an accepted value goes. */
  lands: string | null;
};

export type ReviewItem = {
  contact: { id: string; name: string; company: string | null; title: string | null; email: string | null; phone: string | null; website: string | null; linkedin: string | null };
  rows: ReviewRow[];
};

function currentValue(c: Awaited<ReturnType<typeof getContactProfile>>, field: FillField): string | null {
  const contact = c?.contact;
  if (!contact) return null;
  const extra = (label: string) => contact.extra.find((e) => e.label.toLowerCase() === label.toLowerCase())?.values.join(", ") || null;
  switch (field) {
    case "email": return contact.email;
    case "phone": return [contact.phone, contact.phone2].filter(Boolean).join(" · ") || null;
    case "website": return contact.website;
    default: return extra(fieldSpec(field)?.saveKey ?? "");
  }
}

export async function reviewItem(contactId: string): Promise<ReviewItem | null> {
  const prof = await getContactProfile(contactId);
  if (!prof) return null;
  const { data } = await db().from("contact_fill_suggestions").select("*").eq("contact_id", contactId).eq("status", "pending");
  const order = new Map(FIELD_SPECS.map((f, i) => [f.field, i]));
  const rows: ReviewRow[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => {
      const field = r.field as FillField;
      const current = currentValue(prof, field);
      const lands = field === "email" ? (prof.contact.email ? "Saved as second email; the main one stays" : "Saved as the main email")
        : field === "phone" ? (prof.contact.phone ? "Saved as second phone; the main one stays" : "Saved as the main phone")
        : null;
      return {
        id: String(r.id), field, fieldLabel: fieldSpec(field)?.label ?? field,
        value: r.value as string | string[], label: r.label as FillLabel,
        sourceUrl: (r.source_url as string | null) ?? null, basis: (r.basis as string | null) ?? null,
        confidence: (r.confidence as string | null) ?? null, current, lands,
      };
    })
    .sort((a, b) => (order.get(a.field) ?? 99) - (order.get(b.field) ?? 99));
  const c = prof.contact;
  const li = c.extra.find((e) => /linkedin/i.test(e.label))?.values[0] ?? null;
  return {
    contact: { id: c.id, name: c.name, company: c.company, title: c.job_position, email: c.email, phone: c.phone, website: c.website, linkedin: li },
    rows,
  };
}

export type DecideResult = { accepted: number; rejected: number; failed: Array<{ field: string; message: string }>; odooNotes: string[] };

/** Apply one accepted proposal to its contact. */
async function applyOne(contactId: string, s: { field: FillField; value: string | string[] }, actor: { id: string; isAdmin: boolean }): Promise<string | null> {
  const values = Array.isArray(s.value) ? s.value : [String(s.value)];
  const prof = await getContactProfile(contactId);
  if (!prof) throw new Error("Contact not found.");
  if (s.field === "email") {
    if (!prof.contact.email) { const r = await saveField(contactId, { key: "email", values }, actor); return r.odoo.status === "failed" ? r.odoo.message ?? null : null; }
    await mergeOverrides(contactId, { set: { email2: values[0].toLowerCase() } }, "profile fill: second email");
    await logActivity({ kind: "contact_edit", actorId: actor.id, contactCrmId: contactId, summary: "Second email added (profile fill)", meta: { field: "email2", after: values, via: "profile_fill" } });
    return null;
  }
  if (s.field === "phone") {
    const key = prof.contact.phone ? "phone2" : "phone";
    const r = await saveField(contactId, { key, values }, actor);
    return r.odoo.status === "failed" ? r.odoo.message ?? null : null;
  }
  const spec = fieldSpec(s.field);
  if (!spec) throw new Error(`Unknown field ${s.field}.`);
  const r = await saveField(contactId, { key: spec.saveKey, values }, actor);
  return r.odoo.status === "failed" ? r.odoo.message ?? null : null;
}

/** Accept or reject proposals on one contact. Accepting a company summary approves it for the whole company. */
export async function decide(contactId: string, decisions: Array<{ id: string; accept: boolean; value?: string | string[] }>, actor: { id: string; isAdmin: boolean }): Promise<DecideResult> {
  const out: DecideResult = { accepted: 0, rejected: 0, failed: [], odooNotes: [] };
  const ids = decisions.map((d) => d.id);
  if (!ids.length) return out;
  const { data } = await db().from("contact_fill_suggestions").select("*").in("id", ids).eq("contact_id", contactId).eq("status", "pending");
  const byId = new Map(((data ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.id), r]));
  const now = new Date().toISOString();
  for (const d of decisions) {
    const r = byId.get(d.id);
    if (!r) continue;
    const field = r.field as FillField;
    if (!d.accept) {
      await db().from("contact_fill_suggestions").update({ status: "rejected", decided_at: now, decided_by: actor.id }).eq("id", d.id);
      out.rejected += 1;
      continue;
    }
    // The reviewer may correct the text of a bio or summary before accepting it.
    const value = (field === "bio" || field === "company_summary") && typeof d.value === "string" && d.value.trim() ? d.value.trim() : (r.value as string | string[]);
    try {
      const note = await applyOne(contactId, { field, value }, actor);
      if (note) out.odooNotes.push(`${fieldSpec(field)?.label ?? field}: ${note}`);
      await db().from("contact_fill_suggestions").update({ status: "accepted", value, decided_at: now, decided_by: actor.id }).eq("id", d.id);
      out.accepted += 1;
      if (field === "company_summary") await approveCompanySummary(contactId, String(value), actor);
    } catch (e) {
      out.failed.push({ field, message: e instanceof Error ? e.message : "Could not save." });
    }
  }
  return out;
}

/** Approve a company summary once and apply it to everyone at that company still waiting on it. */
async function approveCompanySummary(contactId: string, summary: string, actor: { id: string; isAdmin: boolean }): Promise<void> {
  const { data: c } = await db().from("crm_contacts").select("company").eq("id", contactId).maybeSingle();
  const company = (c?.company as string | null) ?? null;
  if (!company) return;
  const key = companyKeyOf(company);
  await db().from("company_summaries").upsert({ company_key: key, company, summary, status: "approved", approved_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: "company_key" });
  const { data: peers } = await db().from("crm_contacts").select("id, company").ilike("company", company.replace(/[\\%_]/g, (x) => `\\${x}`)).neq("id", contactId).limit(200);
  const peerIds = ((peers ?? []) as Array<{ id: string; company: string | null }>).filter((p) => p.company && companyKeyOf(p.company) === key).map((p) => p.id);
  if (!peerIds.length) return;
  const { data: waiting } = await db().from("contact_fill_suggestions").select("id, contact_id").eq("status", "pending").eq("field", "company_summary").in("contact_id", peerIds);
  for (const w of (waiting ?? []) as Array<{ id: string; contact_id: string }>) {
    try {
      await saveField(w.contact_id, { key: "Investor business summary", values: [summary] }, actor);
      await db().from("contact_fill_suggestions").update({ status: "accepted", value: summary, decided_at: new Date().toISOString(), decided_by: actor.id }).eq("id", w.id);
    } catch { /* that contact keeps its pending proposal */ }
  }
}

/** Counts for the Enrich step and the review page header. */
export async function fillStats(): Promise<{ pendingContacts: number; pendingProposals: number; accepted: number }> {
  const [{ count: pendingProposals }, { count: accepted }, queue] = await Promise.all([
    db().from("contact_fill_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db().from("contact_fill_suggestions").select("id", { count: "exact", head: true }).eq("status", "accepted"),
    reviewQueue("all").catch(() => []),
  ]);
  return { pendingContacts: queue.length, pendingProposals: pendingProposals ?? 0, accepted: accepted ?? 0 };
}
