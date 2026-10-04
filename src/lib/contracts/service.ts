// SPV contract workflows: render, send for signature, track, countersign and
// the prospect's responses. Each document is its own envelope, so documents
// sent together reach their own statuses independently.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Db } from "./access";
import { renderDocx } from "./docx-engine";
import { openFields, resolveValues } from "./fields";
import { saveToDrive } from "./drive";
import { docxToPdf } from "./render-pdf";
import { placeSignatureFields, readPdfLines } from "./signature-anchors";
import {
  addEvent,
  getContactLite,
  getDocument,
  getEntity,
  getFile,
  getMaster,
  getTemplate,
  getTemplateFields,
  putFile,
  setStatus,
  type ContactLite,
} from "./store";
import { applyEmailTokens, emailTokenValues, withTypedValues } from "./email-tokens";
import { appBase, notifySender, sendCoverEmail, sendExecutedCopy, sendReminderEmail, type Attachment } from "./email";
import { buildCertificate } from "./certificate";
import type { ContractDocument, ContractTemplate, CountersignField, IssuingEntity, TemplateField } from "./types";
import { STOP_STATUSES } from "./types";
import { listFields, replaceFields, type FieldInput } from "@/lib/esignature/fields";
import { uploadToSignatureBucket, writeSignatureAudit } from "@/lib/esignature/storage";
import { STORAGE_BUCKET as SIGNATURE_BUCKET } from "@/lib/esignature/types";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Signing links expire after this many days unless the term sheet sets its own expiry. */
const DEFAULT_EXPIRY_DAYS = 30;

export type Bundle = {
  doc: ContractDocument;
  template: ContractTemplate;
  fields: TemplateField[];
  entity: IssuingEntity | null;
  contact: ContactLite;
};

/**
 * An uploaded contract has no template. It gets a stand-in carrying its own
 * title, so naming, emails and tracking treat both kinds the same; rendering
 * and signature placement branch on `doc.source`.
 */
function uploadTemplate(doc: ContractDocument): ContractTemplate {
  return {
    id: `upload:${doc.id}`,
    key: "upload",
    name: doc.title ?? "Contract",
    kind: "services_agreement",
    subtype: null,
    version: 1,
    status: "active",
    default_entity_id: doc.entity_id,
    entity_match: null,
    signature_anchors: { prospect: { party: "" }, countersign: [] },
    has_expiry: false,
    created_by: doc.created_by,
    created_at: doc.created_at,
  };
}

export const isUpload = (b: Bundle) => b.doc.source === "upload";

/** Stand-in contact for an uploaded draft whose recipient is chosen later. */
export const NO_RECIPIENT: ContactLite = { id: "", name: "Recipient not chosen", email: null, company: null, tags: [], address: null };

export async function loadBundle(db: Db, docId: string): Promise<Bundle | null> {
  const doc = await getDocument(db, docId);
  if (!doc) return null;
  if (doc.source === "upload") {
    const [entity, contact] = await Promise.all([getEntity(db, doc.entity_id), doc.contact_id ? getContactLite(db, doc.contact_id) : Promise.resolve(NO_RECIPIENT)]);
    if (!contact) return null;
    return { doc, template: uploadTemplate(doc), fields: [], entity, contact };
  }
  if (!doc.template_id || !doc.contact_id) return null;
  const [template, fields, entity, contact] = await Promise.all([
    getTemplate(db, doc.template_id),
    getTemplateFields(db, doc.template_id),
    getEntity(db, doc.entity_id),
    getContactLite(db, doc.contact_id),
  ]);
  if (!template || !contact) return null;
  return { doc, template, fields, entity, contact };
}

export function bundleValues(b: Bundle): Record<string, string> {
  return resolveValues(b.fields, b.doc.field_values, b.entity);
}

export function bundleOpenFields(b: Bundle) {
  if (isUpload(b)) return [];
  return openFields(b.fields, b.doc.field_values, b.entity, Boolean(b.template.entity_match));
}

/** "Arrayworks_TermSheet_v3" style file names, matching how proposals are named today. */
export function fileBase(b: Bundle): string {
  const company = (b.contact.company ?? b.contact.name).replace(/[,.]?\s*(inc|llc|corp|ltd)\.?$/i, "").replace(/[^A-Za-z0-9]+/g, "") || "Contract";
  if (isUpload(b)) return `${company}_${(b.doc.title ?? "Contract").replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "Contract"}_v${b.doc.version}`;
  const doc = b.template.kind === "term_sheet" ? "TermSheet" : b.template.kind === "services_agreement" ? "DDSA" : b.template.kind === "advisory_agreement" ? "Advisory" : "NDA";
  return `${company}_${doc}_v${b.doc.version}`;
}

export async function renderBundleDocx(db: Db, b: Bundle, mode: "preview" | "final"): Promise<Buffer> {
  if (isUpload(b)) throw new SendBlockedError("An uploaded contract has no Word version.");
  const master = await getMaster(db, b.template.id);
  return renderDocx({ master, fields: b.fields, entityMatch: b.template.entity_match, values: bundleValues(b), edits: b.doc.body_edits, mode });
}

/** True preview: the same Word → PDF render that is sent for signature. */
export async function renderBundlePdf(db: Db, b: Bundle, mode: "preview" | "final"): Promise<Buffer> {
  if (isUpload(b)) return getFile(db, b.doc.upload_path!);
  const docx = await renderBundleDocx(db, b, mode);
  return docxToPdf(docx, `${fileBase(b)}.docx`);
}

// ── Send ───────────────────────────────────────────────────────────────────

export class SendBlockedError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = "SendBlockedError";
  }
}

type Prepared = {
  b: Bundle;
  /** Template documents only. */
  docx: Buffer | null;
  /** Uploaded contracts: their draft envelope, which becomes the signing request. */
  requestId?: string;
  pdf: Buffer;
  pageCount: number;
  prospectFields: FieldInput[];
  countersign: CountersignField[];
  expiresAt: string;
};

function expiryFor(b: Bundle): string {
  const exp = b.doc.field_values.expiration_date;
  if (b.template.has_expiry && exp && /^\d{4}-\d{2}-\d{2}$/.test(exp)) return new Date(`${exp}T23:59:59Z`).toISOString();
  return new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86400000).toISOString();
}

async function prepare(db: Db, b: Bundle): Promise<Prepared> {
  if (isUpload(b)) {
    // Uploaded PDF: the boxes were placed by hand on its draft envelope.
    const requestId = b.doc.signature_request_id;
    if (!requestId) throw new SendBlockedError(`${b.template.name}: place the signature boxes first.`);
    const placed = await listFields(db, requestId);
    if (!placed.some((f) => f.field_type === "signature")) throw new SendBlockedError(`${b.template.name}: place at least one signature box for the prospect.`);
    const counter = b.doc.countersign_fields ?? [];
    if (!counter.some((f) => f.kind === "signature")) throw new SendBlockedError(`${b.template.name}: place your countersignature box.`);
    const pdf = await getFile(db, b.doc.upload_path!);
    const { data: req } = await db.from("signature_requests").select("page_count").eq("id", requestId).maybeSingle();
    return { b, docx: null, pdf, pageCount: (req?.page_count as number) ?? b.doc.page_count ?? 1, prospectFields: [], countersign: counter, expiresAt: expiryFor(b), requestId };
  }
  const docx = await renderBundleDocx(db, b, "final");
  const pdf = await docxToPdf(docx, `${fileBase(b)}.docx`);
  const { lines, pageCount } = await readPdfLines(new Uint8Array(pdf));
  const placed = placeSignatureFields(lines, b.template.signature_anchors, bundleValues(b));
  const prospectFields: FieldInput[] = [{ field_type: "signature", ...placed.prospect.signature, required: true }];
  if (placed.prospect.name) prospectFields.push({ field_type: "text", ...placed.prospect.name, required: true, placeholder: "Full name" });
  if (placed.prospect.title) prospectFields.push({ field_type: "text", ...placed.prospect.title, required: true, placeholder: "Title" });
  if (placed.prospect.date) prospectFields.push({ field_type: "date", ...placed.prospect.date, required: true });
  return { b, docx, pdf, pageCount, prospectFields, countersign: placed.countersign, expiresAt: expiryFor(b) };
}

export type SendInput = {
  contactId: string;
  documentIds: string[];
  subject: string;
  body: string;
  emailDraftId: string | null;
  attachPdfs: boolean;
  typedValues?: Record<string, string>;
  sender: { id: string; name: string; email: string | null; actorLabel: string };
};

/**
 * Fail closed: every document is validated and rendered before anything is
 * written, so a problem with one document sends nothing.
 */
export async function sendPacket(db: Db, input: SendInput): Promise<{ packetId: string; token: string; delivered: boolean; url: string }> {
  if (!input.documentIds.length) throw new SendBlockedError("Choose at least one document.");
  const bundles: Bundle[] = [];
  for (const id of input.documentIds) {
    const b = await loadBundle(db, id);
    if (!b || b.doc.contact_id !== input.contactId) throw new SendBlockedError("A document does not belong to this contact.");
    if (b.doc.locked || b.doc.status !== "draft") throw new SendBlockedError(`${b.template.name} was already sent. Edit it to create a new version.`);
    bundles.push(b);
  }
  const contact = bundles[0].contact;
  if (!contact.email) throw new SendBlockedError("This contact has no email address.");

  const open = bundles.flatMap((b) => bundleOpenFields(b).map((f) => `${b.template.name}: ${f.label}`));
  if (open.length) throw new SendBlockedError(`Fill the open fields before sending: ${open.join("; ")}.`, { open });

  const tokenValues = withTypedValues(
    emailTokenValues({
      contactName: contact.name,
      company: contact.company,
      senderName: input.sender.name,
      documents: bundles.map((b) => ({ fields: b.fields, values: b.doc.field_values, entityName: b.entity?.legal_name ?? null, title: b.template.name })),
    }),
    input.typedValues,
  );
  const subject = applyEmailTokens(input.subject, tokenValues);
  const body = applyEmailTokens(input.body, tokenValues);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  if (missing.length) throw new SendBlockedError(`The email uses tokens with no value: ${missing.map((m) => `{{${m}}}`).join(", ")}.`, { missing });
  if (!subject.text.trim() || !body.text.trim()) throw new SendBlockedError("The cover email needs a subject and a body.");

  // Render and place signatures for every document first.
  const prepared: Prepared[] = [];
  for (const b of bundles) prepared.push(await prepare(db, b));

  const token = randomBytes(32).toString("hex");
  const { data: packet, error: pErr } = await db
    .from("contract_packets")
    .insert({
      contact_id: input.contactId,
      access_token: token,
      recipient_name: contact.name,
      recipient_email: contact.email,
      subject: subject.text,
      body: body.text,
      email_draft_id: input.emailDraftId,
      attach_pdfs: input.attachPdfs,
      sent_by: input.sender.id,
    })
    .select("id")
    .single();
  if (pErr || !packet) throw new Error(`Could not record the send: ${pErr?.message ?? "unknown error"}`);

  const now = new Date().toISOString();
  const attachments: Attachment[] = [];
  for (const p of prepared) {
    const { b } = p;
    const base = `docs/${b.doc.id}/${fileBase(b)}`;
    if (p.docx) await putFile(db, `${base}.docx`, p.docx, DOCX_MIME);
    await putFile(db, `${base}.pdf`, p.pdf, "application/pdf");

    let requestId: string;
    if (p.requestId) {
      // Uploaded contract: its draft envelope (PDF and placed boxes) is sent as is.
      requestId = p.requestId;
      const { error: uErr } = await db
        .from("signature_requests")
        .update({
          document_name: b.template.name,
          deal_label: contact.company,
          signer_name: contact.name,
          signer_email: contact.email,
          signer_company: contact.company,
          status: "sent",
          access_token: randomBytes(32).toString("hex"),
          sent_at: now,
          contract_document_id: b.doc.id,
          expires_at: p.expiresAt,
        })
        .eq("id", requestId)
        .eq("status", "draft");
      if (uErr) throw new Error(`Could not send the signature request: ${uErr.message}`);
      await writeSignatureAudit(db, { requestId, eventType: "sent", actor: input.sender.actorLabel, metadata: { signer_email: contact.email } });
    } else {
    requestId = crypto.randomUUID();
    const workingPath = `originals/${requestId}.pdf`;
    await uploadToSignatureBucket(db, workingPath, p.pdf, "application/pdf");
    const { error: rErr } = await db.from("signature_requests").insert({
      id: requestId,
      document_name: b.template.name,
      deal_label: contact.company,
      source_format: "docx",
      working_file_path: workingPath,
      page_count: p.pageCount,
      signer_name: contact.name,
      signer_email: contact.email,
      signer_company: bundleValues(b).company_name ?? contact.company,
      status: "sent",
      access_token: randomBytes(32).toString("hex"),
      created_by: input.sender.id,
      sent_at: now,
      contract_document_id: b.doc.id,
      expires_at: p.expiresAt,
    });
    if (rErr) throw new Error(`Could not create the signature request: ${rErr.message}`);
    await replaceFields(db, requestId, p.prospectFields);
    await writeSignatureAudit(db, { requestId, eventType: "created", actor: input.sender.actorLabel, metadata: { contract_document_id: b.doc.id } });
    await writeSignatureAudit(db, { requestId, eventType: "sent", actor: input.sender.actorLabel, metadata: { signer_email: contact.email } });
    }

    await db
      .from("contract_documents")
      .update({
        status: "sent",
        locked: true,
        sent_at: now,
        updated_at: now,
        docx_path: p.docx ? `${base}.docx` : null,
        pdf_path: `${base}.pdf`,
        page_count: p.pageCount,
        signature_request_id: requestId,
        packet_id: packet.id,
        countersign_fields: p.countersign,
        expires_at: p.expiresAt,
      })
      .eq("id", b.doc.id);
    await addEvent(db, b.doc.id, "sent", input.sender.actorLabel, { to: contact.email, version: b.doc.version });
    if (input.attachPdfs) attachments.push({ filename: `${fileBase(b)}.pdf`, content: p.pdf });
  }

  let delivered = false;
  try {
    delivered = (await sendCoverEmail({
      to: contact.email,
      subject: subject.text,
      body: body.text,
      token,
      senderName: input.sender.name,
      senderEmail: input.sender.email,
      attachments,
    })).delivered;
  } catch {
    delivered = false;
  }
  await db.from("contract_packets").update({ delivered }).eq("id", packet.id);
  for (const p of prepared) await addEvent(db, p.b.doc.id, delivered ? "delivered" : "not_delivered", "system");
  return { packetId: packet.id as string, token, delivered, url: `${appBase()}/contracts/${token}` };
}

// ── Tracking actions ───────────────────────────────────────────────────────

async function packetFor(db: Db, doc: ContractDocument) {
  if (!doc.packet_id) return null;
  const { data } = await db.from("contract_packets").select("id, access_token, recipient_email, recipient_name, subject, body, attach_pdfs, sent_by").eq("id", doc.packet_id).maybeSingle();
  return data as { id: string; access_token: string; recipient_email: string; recipient_name: string | null; subject: string; body: string; attach_pdfs: boolean; sent_by: string } | null;
}

function isOpen(doc: ContractDocument) {
  return doc.status === "sent" || doc.status === "viewed";
}

export async function remind(db: Db, docId: string, sender: { name: string; email: string | null; actorLabel: string }) {
  const b = await loadBundle(db, docId);
  if (!b) throw new SendBlockedError("Document not found.");
  if (!isOpen(b.doc)) throw new SendBlockedError("Only documents awaiting signature can be reminded.");
  const packet = await packetFor(db, b.doc);
  if (!packet) throw new SendBlockedError("This document has no send record.");
  const r = await sendReminderEmail({ to: packet.recipient_email, firstName: packet.recipient_name?.split(/\s+/)[0] ?? null, documents: [b.template.name], token: packet.access_token, senderName: sender.name, senderEmail: sender.email });
  await addEvent(db, docId, "reminded", sender.actorLabel, { delivered: r.delivered });
  return r;
}

/** Resend the original cover email (same documents, same version, same link). */
export async function resend(db: Db, docId: string, sender: { name: string; email: string | null; actorLabel: string }) {
  const b = await loadBundle(db, docId);
  if (!b) throw new SendBlockedError("Document not found.");
  if (!isOpen(b.doc)) throw new SendBlockedError("Only documents awaiting signature can be resent.");
  const packet = await packetFor(db, b.doc);
  if (!packet) throw new SendBlockedError("This document has no send record.");
  const attachments: Attachment[] = [];
  if (packet.attach_pdfs && b.doc.pdf_path) attachments.push({ filename: `${fileBase(b)}.pdf`, content: await getFile(db, b.doc.pdf_path) });
  const r = await sendCoverEmail({ to: packet.recipient_email, subject: packet.subject, body: packet.body, token: packet.access_token, senderName: sender.name, senderEmail: sender.email, attachments });
  await addEvent(db, docId, "resent", sender.actorLabel, { delivered: r.delivered });
  return r;
}

export async function cancelRequest(db: Db, docId: string, actorLabel: string) {
  const doc = await getDocument(db, docId);
  if (!doc) throw new SendBlockedError("Document not found.");
  if (!isOpen(doc) && doc.status !== "changes_requested") throw new SendBlockedError("Only a pending signature request can be cancelled.");
  if (doc.signature_request_id) {
    await db.from("signature_requests").update({ status: "voided", voided_at: new Date().toISOString() }).eq("id", doc.signature_request_id);
    await writeSignatureAudit(db, { requestId: doc.signature_request_id, eventType: "voided", actor: actorLabel });
  }
  await setStatus(db, docId, "cancelled");
  await addEvent(db, docId, "cancelled", actorLabel);
}

/** Signing link visits: counted on every open, first open flips Sent → Viewed. */
export async function recordOpen(db: Db, requestId: string) {
  await db.rpc("contract_record_open", { p_request_id: requestId });
  const { data } = await db.from("contract_documents").select("id, status").eq("signature_request_id", requestId).maybeSingle();
  if (!data) return;
  await addEvent(db, data.id, "opened", "prospect");
  if (data.status === "sent") await setStatus(db, data.id, "viewed");
}

/** Lazily expire a pending document whose signing window has passed. */
export async function expireIfDue(db: Db, doc: ContractDocument): Promise<ContractDocument> {
  if (!isOpen(doc) || !doc.expires_at || new Date(doc.expires_at).getTime() > Date.now()) return doc;
  if (doc.signature_request_id) await db.from("signature_requests").update({ status: "voided", voided_at: new Date().toISOString() }).eq("id", doc.signature_request_id);
  await setStatus(db, doc.id, "expired");
  await addEvent(db, doc.id, "expired", "system");
  return { ...doc, status: "expired" };
}

// ── Prospect responses ─────────────────────────────────────────────────────

async function senderOf(db: Db, userId: string): Promise<{ email: string | null; name: string | null }> {
  const { data } = await db.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  return { email: (data?.email as string) ?? null, name: (data?.full_name as string) ?? null };
}

/** Request changes or decline: closes the signing link, notifies the sender, stops follow up. */
export async function prospectRespond(db: Db, docId: string, action: "decline" | "changes", note: string) {
  const b = await loadBundle(db, docId);
  if (!b) throw new SendBlockedError("Document not found.");
  if (!isOpen(b.doc)) throw new SendBlockedError("This document is no longer awaiting your signature.");
  const now = new Date().toISOString();
  if (b.doc.signature_request_id) {
    await db
      .from("signature_requests")
      .update({ status: "voided", voided_at: now, response_note: note || null, ...(action === "decline" ? { declined_at: now } : { changes_requested_at: now }) })
      .eq("id", b.doc.signature_request_id);
  }
  const status = action === "decline" ? "declined" : "changes_requested";
  await setStatus(db, docId, status);
  await addEvent(db, docId, status, b.contact.email ?? "prospect", note ? { note } : undefined);
  const sender = await senderOf(db, b.doc.created_by);
  if (sender.email) {
    await notifySender({
      to: sender.email,
      subject: `${b.contact.company ?? b.contact.name} ${action === "decline" ? "declined" : "requested changes to"} the ${b.template.name}`,
      lines: [
        `${b.contact.name} ${action === "decline" ? "declined" : "requested changes to"} the ${b.template.name} (version ${b.doc.version}).`,
        ...(note ? [`Their note: "${note}"`] : []),
        action === "changes" ? "Open the document to edit it into a new version and send it again." : "The signing link is closed.",
      ],
      url: `${appBase()}/admin/sales/contracts/${docId}`,
    }).catch(() => null);
  }
}

/** Called from the e-signature submit route after the prospect signs and the envelope is sealed. */
export async function onEnvelopeSigned(db: Db, requestId: string) {
  const { data } = await db.from("contract_documents").select("id").eq("signature_request_id", requestId).maybeSingle();
  if (!data) return;
  const b = await loadBundle(db, data.id as string);
  if (!b) return;
  await setStatus(db, b.doc.id, "awaiting_countersign");
  await addEvent(db, b.doc.id, "signed", b.contact.email ?? "prospect");
  const sender = await senderOf(db, b.doc.created_by);
  if (sender.email) {
    await notifySender({
      to: sender.email,
      subject: `${b.contact.company ?? b.contact.name} signed the ${b.template.name}`,
      lines: [`${b.contact.name} signed the ${b.template.name}.`, "Countersign it to send the executed copy and the signature certificate automatically."],
      url: `${appBase()}/admin/sales/contracts/${b.doc.id}`,
    }).catch(() => null);
  }
}

// ── Countersign ────────────────────────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

export async function countersign(
  db: Db,
  docId: string,
  input: { signature: string; name: string; title: string; signer: { id: string; email: string | null; actorLabel: string; displayName: string }; saveToDrive?: boolean },
) {
  const b = await loadBundle(db, docId);
  if (!b) throw new SendBlockedError("Document not found.");
  if (b.doc.status !== "awaiting_countersign") throw new SendBlockedError("This document is not waiting for a countersignature.");
  if (!input.signature.startsWith("data:image/png")) throw new SendBlockedError("Add your signature first.");
  const { data: req } = await db.from("signature_requests").select("id, signed_file_path, signer_name, signer_email, access_token").eq("id", b.doc.signature_request_id).maybeSingle();
  if (!req?.signed_file_path) throw new SendBlockedError("The prospect's sealed copy is not ready yet. Try again in a minute.");

  const dl = await db.storage.from(SIGNATURE_BUCKET).download(req.signed_file_path);
  if (dl.error || !dl.data) throw new Error("Could not load the signed copy.");
  const pdf = await PDFDocument.load(new Uint8Array(await dl.data.arrayBuffer()));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const png = await pdf.embedPng(dataUrlToBytes(input.signature));
  const pages = pdf.getPages();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  for (const f of b.doc.countersign_fields ?? []) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const W = page.getWidth();
    const H = page.getHeight();
    const left = f.x * W;
    const boxW = f.width * W;
    const boxH = f.height * H;
    const bottom = H - f.y * H - boxH;
    if (f.kind === "signature") {
      const scale = Math.min(boxW / png.width, boxH / png.height);
      page.drawImage(png, { x: left, y: bottom + (boxH - png.height * scale) / 2, width: png.width * scale, height: png.height * scale });
    } else {
      const text = f.kind === "name" ? input.name : f.kind === "title" ? input.title : today;
      if (text.trim()) page.drawText(text.trim(), { x: left + 2, y: bottom + 2, size: Math.max(8, Math.min(11, boxH * 0.7)), font, color: rgb(0.06, 0.09, 0.16) });
    }
  }
  const executed = Buffer.from(await pdf.save());
  const hash = createHash("sha256").update(executed).digest("hex");

  const { data: audit } = await db.from("signature_audit_events").select("event_type, actor, ip_address, created_at").eq("request_id", req.id).order("created_at");
  const certificate = await buildCertificate({
    documentTitle: b.template.name,
    company: b.contact.company ?? b.contact.name,
    documentHash: hash,
    signer: { name: req.signer_name as string | null, email: req.signer_email as string | null },
    countersigner: { name: input.name, email: input.signer.email },
    events: [
      ...((audit ?? []) as { event_type: string; actor: string | null; ip_address: string | null; created_at: string }[]).map((e) => ({ at: e.created_at, what: e.event_type, who: e.actor, ip: e.ip_address })),
      { at: new Date().toISOString(), what: "countersigned", who: input.signer.actorLabel, ip: null },
    ],
  });

  const base = `docs/${b.doc.id}/${fileBase(b)}`;
  await putFile(db, `${base}_EXECUTED.pdf`, executed, "application/pdf");
  await putFile(db, `${base}_certificate.pdf`, certificate, "application/pdf");
  await setStatus(db, b.doc.id, "signed", { executed_path: `${base}_EXECUTED.pdf`, certificate_path: `${base}_certificate.pdf` });
  await addEvent(db, b.doc.id, "countersigned", input.signer.actorLabel, { sha256: hash });

  const packet = await packetFor(db, b.doc);
  if (packet) {
    await sendExecutedCopy({
      to: packet.recipient_email,
      firstName: packet.recipient_name?.split(/\s+/)[0] ?? null,
      documentTitle: b.template.name,
      company: b.contact.company ?? b.contact.name,
      senderName: input.signer.displayName,
      senderEmail: input.signer.email,
      token: packet.access_token,
      attachments: [
        { filename: `${fileBase(b)}_EXECUTED.pdf`, content: executed },
        { filename: "Signature_certificate.pdf", content: certificate },
      ],
    }).then((r) => addEvent(db, b.doc.id, r.delivered ? "executed_copy_sent" : "executed_copy_not_sent", "system")).catch(() => addEvent(db, b.doc.id, "executed_copy_not_sent", "system"));
  }

  // Optional: the executed copy and certificate also go to the countersigner's Google Drive.
  let drive: { saved: true; folderUrl: string; path: string } | { saved: false; error: string } | null = null;
  if (input.saveToDrive) {
    const day = new Date().toISOString().slice(0, 10);
    try {
      const saved = await saveToDrive(input.signer.id, {
        company: b.contact.company ?? b.contact.name,
        files: [
          { name: `${b.template.name} (executed) ${day}.pdf`, bytes: executed },
          { name: `${b.template.name} (certificate) ${day}.pdf`, bytes: certificate },
        ],
      });
      drive = { saved: true, folderUrl: saved.folderUrl, path: saved.path };
      await addEvent(db, b.doc.id, "saved_to_drive", input.signer.actorLabel, { path: saved.path, files: saved.files.length, url: saved.folderUrl });
    } catch (err) {
      drive = { saved: false, error: err instanceof Error ? err.message : "Google Drive save failed." };
      await addEvent(db, b.doc.id, "drive_save_failed", input.signer.actorLabel, { error: drive.error });
    }
  }
  return { hash, drive };
}

export function stopsFollowUp(status: ContractDocument["status"]): boolean {
  return STOP_STATUSES.includes(status);
}

// ── Signing page gate (contract envelopes only) ────────────────────────────

/**
 * Called by /sign/[token] for envelopes created from contracts: closes the link
 * when the document was declined, sent back for changes, cancelled or has
 * expired, and counts the open otherwise. Returns a message to show, or null.
 */
export async function contractSigningGate(db: Db, request: { id: string; status: string }): Promise<{ title: string; message: string } | null> {
  const { data } = await db.from("contract_documents").select("*").eq("signature_request_id", request.id).maybeSingle();
  if (!data) return null;
  let doc = data as ContractDocument;
  doc = await expireIfDue(db, doc);
  if (doc.status === "expired") return { title: "This signing link has expired", message: "Reply to the sender for a new copy." };
  if (doc.status === "declined") return { title: "Document declined", message: "You declined this document. The sender has been notified." };
  if (doc.status === "changes_requested") return { title: "Changes requested", message: "You asked for changes. The sender will send a revised version." };
  if (doc.status === "cancelled") return { title: "Request withdrawn", message: "The sender withdrew this signature request." };
  if (request.status === "sent" || request.status === "viewed") await recordOpen(db, request.id);
  return null;
}
