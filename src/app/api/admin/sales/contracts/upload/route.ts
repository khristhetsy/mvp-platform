import { NextResponse } from "next/server";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { addEvent, getContactLite, getEntity, putFile } from "@/lib/contracts/store";
import { createDraftRequest } from "@/lib/esignature/requests";
import { countPdfPages, PdfValidationError } from "@/lib/esignature/pdf";
import { uploadToSignatureBucket, writeSignatureAudit } from "@/lib/esignature/storage";
import { MAX_UPLOAD_BYTES, MIME_PDF } from "@/lib/esignature/types";
import { isContractType } from "@/lib/contracts/types";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST (multipart: file, contractType, entityId, contactId optional) — upload a
 * finished contract PDF. Creates the contract document and its draft signing
 * envelope; the signature boxes are then placed with the e-signature placement
 * tool. Without contactId the recipient is chosen later, before the cover email.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const contactId = String(form?.get("contactId") ?? "");
  const entityId = String(form?.get("entityId") ?? "");
  const contractType = String(form?.get("contractType") ?? "");
  if (!(file instanceof File)) return bad("Choose the contract file to upload.");
  if (!isContractType(contractType)) return bad("Choose the contract type.");
  if (contactId && !/^[0-9a-f-]{36}$/i.test(contactId)) return bad("Choose who the contract goes to.");
  if (!/^[0-9a-f-]{36}$/i.test(entityId)) return bad("Choose the issuing entity.");
  if (contactId && !(await canSeeContact(actor, contactId))) return forbidden();

  const name = file.name || "contract.pdf";
  const isPdf = file.type === MIME_PDF || (!file.type && /\.pdf$/i.test(name)) || /\.pdf$/i.test(name);
  if (!isPdf) return bad(/\.docx?$/i.test(name) ? "Upload the contract as a PDF. In Word: File › Save As › PDF, then upload that file." : "Upload the contract as a PDF.");
  if (file.size > MAX_UPLOAD_BYTES) return bad(`The file is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`);

  const [contact, entity] = await Promise.all([contactId ? getContactLite(actor.db, contactId) : Promise.resolve(null), getEntity(actor.db, entityId)]);
  if (contactId && !contact) return bad("Contact not found.", 404);
  if (!entity) return bad("Issuing entity not found.");

  const bytes = Buffer.from(await file.arrayBuffer());
  let pageCount: number;
  try {
    pageCount = await countPdfPages(bytes);
  } catch (err) {
    return bad(err instanceof PdfValidationError ? err.message : "This file isn't a readable PDF.", 422);
  }

  const title = name.replace(/\.pdf$/i, "").trim().slice(0, 200) || "Contract";
  const docId = crypto.randomUUID();
  const uploadPath = `uploads/${docId}/original.pdf`;
  await putFile(actor.db, uploadPath, bytes, MIME_PDF);

  // The draft envelope holds the working PDF and the placed boxes until send.
  const workingPath = `originals/${crypto.randomUUID()}.pdf`;
  await uploadToSignatureBucket(actor.db, workingPath, bytes, MIME_PDF);
  const request = await createDraftRequest(actor.db, {
    documentName: title,
    dealLabel: contact?.company ?? null,
    sourceFormat: "pdf",
    workingFilePath: workingPath,
    pageCount,
    createdBy: actor.userId,
  });
  await writeSignatureAudit(actor.db, { requestId: request.id, eventType: "created", actor: actor.actorLabel, metadata: { contract_document_id: docId, document_name: title } });

  const { error } = await actor.db.from("contract_documents").insert({
    id: docId,
    contact_id: contact ? contactId : null,
    source: "upload",
    contract_type: contractType,
    title,
    upload_path: uploadPath,
    entity_id: entityId,
    version: 1,
    status: "draft",
    page_count: pageCount,
    signature_request_id: request.id,
    created_by: actor.userId,
  });
  if (error) return NextResponse.json({ error: `Could not save the contract: ${error.message}` }, { status: 500 });
  await actor.db
    .from("signature_requests")
    .update(contact ? { contract_document_id: docId, signer_name: contact.name, signer_email: contact.email, signer_company: contact.company } : { contract_document_id: docId })
    .eq("id", request.id);
  await addEvent(actor.db, docId, "uploaded", actor.actorLabel, { file: name, pages: pageCount });
  await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.uploaded", entityType: "contract_documents", entityId: docId, metadata: { file: name, pages: pageCount, contract_type: contractType, contact_id: contact ? contactId : null } });

  return NextResponse.json({ ok: true, documentId: docId, requestId: request.id, placeUrl: `/admin/signatures/${request.id}?contract=${docId}` });
}
