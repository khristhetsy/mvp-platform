import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { createDraft, getContactLite, getTemplate } from "@/lib/contracts/store";
import { expireIfDue } from "@/lib/contracts/service";
import type { ContractDocument } from "@/lib/contracts/types";
import { writeAuditLog } from "@/lib/data/audit";
import { errorMessage } from "@/lib/contracts/route-helpers";

export const dynamic = "force-dynamic";

const LIST_COLS =
  "id, document_key, version, status, locked, sent_at, open_count, last_opened_at, created_at, updated_at, archived_at, expires_at, created_by, contact_id, template_id, signature_request_id, source, title, contract_type, page_count, " +
  "template:contract_templates(name, kind), entity:contract_entities(short_name, legal_name), contact:crm_contacts(name, company, email), " +
  "request:signature_requests!contract_documents_signature_request_id_fkey(open_count, last_opened_at)";

/**
 * GET — contract documents, latest version of each. ?contactId= limits to one
 * prospect; without it, every document the caller can see (pipeline view).
 * ?archived=1 includes archived documents.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId");
  const withArchived = url.searchParams.get("archived") === "1";

  let q = actor.db.from("contract_documents").select(LIST_COLS).order("updated_at", { ascending: false }).limit(1000);
  if (contactId) {
    if (!(await canSeeContact(actor, contactId))) return forbidden();
    q = q.eq("contact_id", contactId);
  } else if (!actor.scope.canSeeAllContacts) {
    const { data: mine } = await actor.db.from("crm_contacts").select("id").contains("assignee_ids", [actor.userId]).limit(5000);
    const ids = ((mine ?? []) as { id: string }[]).map((r) => r.id);
    // Their contacts' documents, plus uploads they made that have no recipient yet.
    q = ids.length ? q.or(`contact_id.in.(${ids.join(",")}),and(contact_id.is.null,created_by.eq.${actor.userId})`) : q.is("contact_id", null).eq("created_by", actor.userId);
  }
  if (!withArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the latest version of each document key.
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const key = row.document_key as string;
    const cur = latest.get(key);
    if (!cur || (row.version as number) > (cur.version as number)) latest.set(key, row);
  }
  const documents = [];
  for (const row of latest.values()) {
    const doc = await expireIfDue(actor.db, row as unknown as ContractDocument);
    // Uploaded contracts carry their own title where template documents show the template name.
    const template = row.template ?? (row.source === "upload" ? { name: (row.title as string) ?? "Contract", kind: "upload" } : null);
    // Review only documents have no signing request; their opens are counted on the document.
    const request = row.request ?? (doc.status === "shared" ? { open_count: (row.open_count as number) ?? 0, last_opened_at: (row.last_opened_at as string | null) ?? null } : null);
    documents.push({ ...row, template, request, status: doc.status, mine: row.created_by === actor.userId });
  }
  return NextResponse.json({ documents, isAdmin: actor.isAdmin });
}

const createSchema = z.object({ contactId: z.string().uuid(), templateIds: z.array(z.string().uuid()).min(1).max(6) });

/** POST — Duplicate: prospect scoped copies of the chosen masters. The masters never change. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Choose a contact and at least one document.");
  const { contactId, templateIds } = parsed.data;
  if (!(await canSeeContact(actor, contactId))) return forbidden();
  const contact = await getContactLite(actor.db, contactId);
  if (!contact) return bad("Contact not found.", 404);

  const termSheets = [];
  for (const id of templateIds) {
    const t = await getTemplate(actor.db, id);
    if (!t || t.status !== "active") return bad("A selected template is not available.");
    if (t.kind === "term_sheet") termSheets.push(t);
  }
  if (termSheets.length > 1) return bad("Pick one term sheet type.");

  try {
    const docs = [];
    for (const templateId of templateIds) {
      const doc = await createDraft(actor.db, { contactId, templateId, createdBy: actor.userId });
      docs.push(doc);
      await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.document_created", entityType: "contract_documents", entityId: doc.id, metadata: { contact_id: contactId, template_id: templateId } });
    }
    return NextResponse.json({ documents: docs.map((d) => ({ id: d.id })) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Could not create the documents.") }, { status: 500 });
  }
}
