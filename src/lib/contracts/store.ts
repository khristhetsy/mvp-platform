// Data access for SPV contracts. Service-role client only (see access.ts).

import "server-only";
import type { Db } from "./access";
import { tokenizeDoc, loadDocx } from "./docx-engine";
import { defaultCompanyName, defaultSpvName } from "./fields";
import type {
  BodyEdits,
  ContractDocument,
  ContractTemplate,
  IssuingEntity,
  TemplateField,
} from "./types";
import { CONTRACTS_BUCKET, EMPTY_EDITS } from "./types";
import { getContactProfile } from "@/lib/sales/contacts";

// ── bytea helpers (PostgREST returns bytea as "\x" hex) ─────────────────────

export function byteaToBuffer(v: unknown): Buffer {
  if (typeof v !== "string") throw new Error("Master file is missing.");
  return v.startsWith("\\x") ? Buffer.from(v.slice(2), "hex") : Buffer.from(v, "base64");
}
export function bufferToBytea(b: Buffer): string {
  return `\\x${b.toString("hex")}`;
}

const TEMPLATE_COLS =
  "id, key, name, kind, subtype, version, status, default_entity_id, entity_match, signature_anchors, has_expiry, created_by, created_at, master_filename";

// ── Entities ───────────────────────────────────────────────────────────────

export async function listEntities(db: Db): Promise<IssuingEntity[]> {
  const { data } = await db.from("contract_entities").select("id, legal_name, short_name, address, signatory_name, signatory_title, active").eq("active", true).order("legal_name");
  return (data ?? []) as IssuingEntity[];
}

export async function getEntity(db: Db, id: string | null): Promise<IssuingEntity | null> {
  if (!id) return null;
  const { data } = await db.from("contract_entities").select("id, legal_name, short_name, address, signatory_name, signatory_title, active").eq("id", id).maybeSingle();
  return (data as IssuingEntity) ?? null;
}

// ── Templates ──────────────────────────────────────────────────────────────

export type TemplateCard = ContractTemplate & { master_filename: string; usage: number; versions: number };

/** Latest active version of each master, with how many documents used it. */
export async function listTemplateCards(db: Db): Promise<TemplateCard[]> {
  const { data } = await db.from("contract_templates").select(TEMPLATE_COLS).order("key").order("version", { ascending: false });
  const rows = (data ?? []) as (ContractTemplate & { master_filename: string })[];
  const latest = new Map<string, ContractTemplate & { master_filename: string }>();
  const versions = new Map<string, number>();
  for (const r of rows) {
    versions.set(r.key, (versions.get(r.key) ?? 0) + 1);
    if (r.status === "active" && !latest.has(r.key)) latest.set(r.key, r);
  }
  const ids = rows.map((r) => r.id);
  const usage = new Map<string, number>();
  if (ids.length) {
    const { data: docs } = await db.from("contract_documents").select("template_id, version").in("template_id", ids).eq("version", 1);
    const byId = new Map(rows.map((r) => [r.id, r.key]));
    for (const d of (docs ?? []) as { template_id: string }[]) {
      const key = byId.get(d.template_id);
      if (key) usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  return [...latest.values()].map((t) => ({ ...t, usage: usage.get(t.key) ?? 0, versions: versions.get(t.key) ?? 1 }));
}

export async function listTemplateHistory(db: Db, key: string) {
  const { data } = await db.from("contract_templates").select("id, version, status, master_filename, created_at, created_by").eq("key", key).order("version", { ascending: false });
  const rows = (data ?? []) as Array<{ id: string; version: number; status: string; master_filename: string; created_at: string; created_by: string | null }>;
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const byId = new Map(((people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name ?? p.email]));
  return rows.map((r) => ({ ...r, author: r.created_by ? byId.get(r.created_by) ?? null : null }));
}

export async function getTemplate(db: Db, id: string): Promise<ContractTemplate | null> {
  const { data } = await db.from("contract_templates").select(TEMPLATE_COLS).eq("id", id).maybeSingle();
  return (data as ContractTemplate) ?? null;
}

export async function getTemplateFields(db: Db, templateId: string): Promise<TemplateField[]> {
  const { data } = await db
    .from("contract_template_fields")
    .select("token, label, type, required, default_value, position_ref, sort_order")
    .eq("template_id", templateId)
    .order("sort_order");
  return (data ?? []) as TemplateField[];
}

export async function getMaster(db: Db, templateId: string): Promise<Buffer> {
  const { data } = await db.from("contract_templates").select("master_docx").eq("id", templateId).maybeSingle();
  return byteaToBuffer(data?.master_docx);
}

/** New master version (Replace file). Field maps carry over; the file must still contain every field. */
export async function replaceMaster(db: Db, templateId: string, file: Buffer, filename: string, userId: string): Promise<{ id: string; version: number }> {
  const current = await getTemplate(db, templateId);
  if (!current) throw new Error("Template not found.");
  const fields = await getTemplateFields(db, templateId);
  const { doc } = await loadDocx(file);
  tokenizeDoc(doc, fields, current.entity_match); // throws TemplateMatchError naming missing text

  const { data: top } = await db.from("contract_templates").select("version").eq("key", current.key).order("version", { ascending: false }).limit(1);
  const version = ((top?.[0]?.version as number) ?? current.version) + 1;
  const { data: tpl, error } = await db
    .from("contract_templates")
    .insert({
      key: current.key,
      name: current.name,
      kind: current.kind,
      subtype: current.subtype,
      version,
      status: "active",
      master_docx: bufferToBytea(file),
      master_filename: filename,
      default_entity_id: current.default_entity_id,
      entity_match: current.entity_match,
      signature_anchors: current.signature_anchors,
      has_expiry: current.has_expiry,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !tpl) throw new Error(`Could not save the new master: ${error?.message ?? "unknown error"}`);
  const { error: fErr } = await db.from("contract_template_fields").insert(fields.map((f) => ({ ...f, template_id: tpl.id })));
  if (fErr) throw new Error(fErr.message);
  await db.from("contract_templates").update({ status: "retired" }).eq("key", current.key).neq("id", tpl.id);
  return { id: tpl.id as string, version };
}

// ── Documents ──────────────────────────────────────────────────────────────

const DOC_COLS = "*";

export async function getDocument(db: Db, id: string): Promise<ContractDocument | null> {
  const { data } = await db.from("contract_documents").select(DOC_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return normalizeDoc(data);
}

function normalizeDoc(row: Record<string, unknown>): ContractDocument {
  const edits = (row.body_edits as BodyEdits | null) ?? EMPTY_EDITS;
  return {
    ...(row as unknown as ContractDocument),
    source: row.source === "upload" ? "upload" : "template",
    field_values: (row.field_values as Record<string, string>) ?? {},
    body_edits: { edits: edits.edits ?? {}, inserted: edits.inserted ?? [] },
  };
}

export type ContactLite = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  tags: string[];
  address: string | null;
};

/** The contact as the Sales Hub shows it (Odoo fields with user overrides applied). */
export async function getContactLite(_db: Db, id: string): Promise<ContactLite | null> {
  const profile = await getContactProfile(id);
  if (!profile) return null;
  const c = profile.contact;
  const cityLine = [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const address = [c.street, c.street2, cityLine || null].filter(Boolean).join("\n") || null;
  return { id: c.id, name: c.name, email: c.email, company: c.company, tags: c.tags ?? [], address };
}

/** Prefill from the contact so the drafter starts from the prospect's facts. */
export function prefillValues(contact: ContactLite, fields: TemplateField[]): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const guesses: Record<string, string> = {
    company_name: defaultCompanyName(contact.company),
    spv_name: defaultSpvName(contact.company),
    date: today,
    company_address: contact.address ?? "",
    company_email: contact.email ?? "",
  };
  const out: Record<string, string> = {};
  for (const f of fields) if (guesses[f.token]) out[f.token] = guesses[f.token];
  return out;
}

export async function createDraft(
  db: Db,
  input: { contactId: string; templateId: string; createdBy: string; documentKey?: string; version?: number; fieldValues?: Record<string, string>; bodyEdits?: BodyEdits; entityId?: string | null },
): Promise<ContractDocument> {
  const tpl = await getTemplate(db, input.templateId);
  if (!tpl) throw new Error("Template not found.");
  let values = input.fieldValues;
  if (!values) {
    const contact = await getContactLite(db, input.contactId);
    const fields = await getTemplateFields(db, input.templateId);
    values = contact ? prefillValues(contact, fields) : {};
  }
  const row: Record<string, unknown> = {
    contact_id: input.contactId,
    template_id: tpl.id,
    template_version: tpl.version,
    entity_id: input.entityId === undefined ? tpl.default_entity_id : input.entityId,
    version: input.version ?? 1,
    field_values: values,
    body_edits: input.bodyEdits ?? EMPTY_EDITS,
    status: "draft",
    created_by: input.createdBy,
  };
  if (input.documentKey) row.document_key = input.documentKey;
  const { data, error } = await db.from("contract_documents").insert(row).select(DOC_COLS).single();
  if (error || !data) throw new Error(`Could not create the document: ${error?.message ?? "unknown error"}`);
  return normalizeDoc(data);
}

/** Editing after send: a new draft version with the same key, copied from the sent one. */
export async function newVersionFrom(db: Db, doc: ContractDocument, userId: string): Promise<ContractDocument> {
  if (!doc.template_id) throw new Error("An uploaded contract has no editable version. Upload the revised file instead.");
  const { data: top } = await db.from("contract_documents").select("version").eq("document_key", doc.document_key).order("version", { ascending: false }).limit(1);
  const version = ((top?.[0]?.version as number) ?? doc.version) + 1;
  return createDraft(db, {
    contactId: doc.contact_id,
    templateId: doc.template_id,
    createdBy: userId,
    documentKey: doc.document_key,
    version,
    fieldValues: doc.field_values,
    bodyEdits: doc.body_edits,
    entityId: doc.entity_id,
  });
}

export async function updateDraft(db: Db, id: string, patch: { field_values?: Record<string, string>; body_edits?: BodyEdits; entity_id?: string | null }) {
  const { error } = await db
    .from("contract_documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("locked", false);
  if (error) throw new Error(error.message);
}

export async function addEvent(db: Db, docId: string, kind: string, actor: string | null, detail?: Record<string, unknown>) {
  await db.from("contract_events").insert({ contract_document_id: docId, kind, actor, detail: detail ?? null });
}

export async function setStatus(db: Db, id: string, status: ContractDocument["status"], extra: Record<string, unknown> = {}) {
  await db.from("contract_documents").update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", id);
}

// ── Storage ────────────────────────────────────────────────────────────────

export async function putFile(db: Db, path: string, bytes: Buffer, contentType: string) {
  const { error } = await db.storage.from(CONTRACTS_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Could not store ${path}: ${error.message}`);
}
export async function getFile(db: Db, path: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(CONTRACTS_BUCKET).download(path);
  if (error || !data) throw new Error("File not available.");
  return Buffer.from(await data.arrayBuffer());
}
export async function signedUrl(db: Db, path: string, seconds = 300): Promise<string | null> {
  const { data } = await db.storage.from(CONTRACTS_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
