import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canCancelOrArchive } from "@/lib/contracts/access";
import { getMaster, listEntities, updateDraft } from "@/lib/contracts/store";
import { bundleOpenFields } from "@/lib/contracts/service";
import { buildModel, loadDocx, tokenizeDoc } from "@/lib/contracts/docx-engine";
import { actorAndBundle } from "@/lib/contracts/route-helpers";
import { renderConfigured } from "@/lib/contracts/render-pdf";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

/** GET — everything the editor and the tracking panel need for one document. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  const db = actor.db;

  // Uploaded contracts have no Word master: no editor blocks, the PDF is the document.
  let blocks: ReturnType<typeof buildModel> = [];
  if (b.doc.source !== "upload") {
    const { doc } = await loadDocx(await getMaster(db, b.template.id));
    tokenizeDoc(doc, b.fields, b.template.entity_match, { strict: false });
    blocks = buildModel(doc);
  }

  const [entities, events, versions, request, packet] = await Promise.all([
    listEntities(db),
    db.from("contract_events").select("kind, actor, detail, created_at").eq("contract_document_id", b.doc.id).order("created_at"),
    db.from("contract_documents").select("id, version, status, sent_at, created_at").eq("document_key", b.doc.document_key).order("version", { ascending: false }),
    b.doc.signature_request_id
      ? db.from("signature_requests").select("open_count, last_opened_at, viewed_at, signed_at, response_note, expires_at").eq("id", b.doc.signature_request_id).maybeSingle()
      : Promise.resolve({ data: null }),
    b.doc.packet_id ? db.from("contract_packets").select("access_token, recipient_email, sent_at, delivered").eq("id", b.doc.packet_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    doc: {
      id: b.doc.id,
      version: b.doc.version,
      status: b.doc.status,
      locked: b.doc.locked,
      entity_id: b.doc.entity_id,
      field_values: b.doc.field_values,
      body_edits: b.doc.body_edits,
      page_count: b.doc.page_count,
      sent_at: b.doc.sent_at,
      expires_at: b.doc.expires_at,
      archived_at: b.doc.archived_at,
      updated_at: b.doc.updated_at,
      has_pdf: Boolean(b.doc.pdf_path),
      has_executed: Boolean(b.doc.executed_path),
      has_certificate: Boolean(b.doc.certificate_path),
      created_by: b.doc.created_by,
      source: b.doc.source,
      contract_type: b.doc.contract_type,
      has_recipient: Boolean(b.doc.contact_id),
      signature_request_id: b.doc.signature_request_id,
      countersign_count: (b.doc.countersign_fields ?? []).filter((f) => f.kind === "signature").length,
    },
    template: { id: b.template.id, name: b.template.name, kind: b.template.kind, version: b.template.version, entity_match: b.template.entity_match, has_expiry: b.template.has_expiry },
    contact: b.contact,
    fields: b.fields,
    entities,
    blocks,
    open: bundleOpenFields(b),
    events: events.data ?? [],
    versions: versions.data ?? [],
    request: request.data,
    packet: packet.data ? { recipient_email: packet.data.recipient_email, sent_at: packet.data.sent_at, delivered: packet.data.delivered } : null,
    renderConfigured: renderConfigured(),
    can: { cancelOrArchive: canCancelOrArchive(actor, b.doc.created_by), delete: actor.isAdmin },
  });
}

const segment = z.object({ text: z.string().max(20000), b: z.boolean().optional(), i: z.boolean().optional() });
const patchSchema = z.object({
  field_values: z.record(z.string().regex(/^[a-z0-9_]+$/), z.string().max(5000)).optional(),
  body_edits: z
    .object({
      edits: z.record(z.string().max(40), z.array(segment).max(400).nullable()),
      inserted: z.array(z.object({ id: z.string().max(40), after: z.string().max(40), segments: z.array(segment).max(400) })).max(200),
    })
    .optional(),
  entity_id: z.string().uuid().nullable().optional(),
});

/** PATCH — save edits to a draft (autosave). A sent version is locked. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  if (b.doc.locked) return bad("This version was sent and is locked. Create a new version to edit.", 409);
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid edit.");
  const patch = parsed.data;

  const known = new Set(b.fields.map((f) => f.token));
  if (patch.field_values && Object.keys(patch.field_values).some((k) => !known.has(k))) return bad("Unknown field.");
  if (patch.entity_id) {
    const entities = await listEntities(actor.db);
    if (!entities.some((e) => e.id === patch.entity_id)) return bad("Unknown issuing entity.");
  }

  await updateDraft(actor.db, b.doc.id, patch);

  const changed: Record<string, { before: string | null; after: string | null }> = {};
  if (patch.field_values) {
    for (const [k, v] of Object.entries(patch.field_values)) {
      const before = b.doc.field_values[k] ?? null;
      if (before !== v) changed[k] = { before, after: v };
    }
  }
  if (patch.entity_id !== undefined && patch.entity_id !== b.doc.entity_id) changed.issuing_entity = { before: b.doc.entity_id, after: patch.entity_id };
  const bodyChanged = patch.body_edits !== undefined && JSON.stringify(patch.body_edits) !== JSON.stringify(b.doc.body_edits);
  if (Object.keys(changed).length || bodyChanged) {
    await writeAuditLog(actor.db, {
      userId: actor.userId,
      action: "contracts.document_edited",
      entityType: "contract_documents",
      entityId: b.doc.id,
      metadata: { fields: changed, body_edited: bodyChanged, version: b.doc.version },
    });
  }

  const fresh = { ...b, doc: { ...b.doc, ...patch, field_values: patch.field_values ?? b.doc.field_values } };
  if (patch.entity_id !== undefined) fresh.entity = patch.entity_id ? (await listEntities(actor.db)).find((e) => e.id === patch.entity_id) ?? null : null;
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), open: bundleOpenFields(fresh as typeof b) });
}
