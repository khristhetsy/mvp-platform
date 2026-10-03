import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden } from "@/lib/contracts/access";
import { actorAndBundle } from "@/lib/contracts/route-helpers";
import { addEvent, getContactLite } from "@/lib/contracts/store";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ contactId: z.string().uuid() });

/**
 * POST — choose (or change) who an uploaded draft goes to. Done last, after the
 * signature boxes are placed; the send flow for that contact follows.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  if (b.doc.source !== "upload" || b.doc.status !== "draft") return bad("The recipient can only be chosen on an uploaded draft.", 409);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Choose who the contract goes to.");
  const { contactId } = parsed.data;
  if (!(await canSeeContact(actor, contactId))) return forbidden();
  const contact = await getContactLite(actor.db, contactId);
  if (!contact) return bad("Contact not found.", 404);

  const { error } = await actor.db.from("contract_documents").update({ contact_id: contactId, updated_at: new Date().toISOString() }).eq("id", b.doc.id);
  if (error) return NextResponse.json({ error: `Could not save the recipient: ${error.message}` }, { status: 500 });
  if (b.doc.signature_request_id) {
    await actor.db
      .from("signature_requests")
      .update({ signer_name: contact.name, signer_email: contact.email, signer_company: contact.company, deal_label: contact.company })
      .eq("id", b.doc.signature_request_id);
  }
  await addEvent(actor.db, b.doc.id, "recipient_chosen", actor.actorLabel, { contact: contact.name });
  await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.recipient_chosen", entityType: "contract_documents", entityId: b.doc.id, metadata: { contact_id: contactId } });

  return NextResponse.json({ ok: true, sendUrl: `/admin/sales/contracts/send?contact=${contactId}&doc=${b.doc.id}` });
}
