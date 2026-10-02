import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canCancelOrArchive, forbidden } from "@/lib/contracts/access";
import { cancelRequest, remind, resend, SendBlockedError } from "@/lib/contracts/service";
import { addEvent } from "@/lib/contracts/store";
import { actorAndBundle, errorMessage } from "@/lib/contracts/route-helpers";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["remind", "resend", "cancel", "archive", "restore", "delete"]) });
const PENDING = new Set(["sent", "viewed"]);

/** POST — row menu actions (build spec §4 Step 4 and §5 transitions). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await actorAndBundle(id);
  if ("error" in r) return r.error;
  const { actor, b } = r;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Unknown action.");
  const action = parsed.data.action;
  const sender = { name: actor.profile.full_name ?? actor.profile.email ?? "iCFO", email: actor.profile.email ?? null, actorLabel: actor.actorLabel };
  const audit = (extra?: Record<string, unknown>) =>
    writeAuditLog(actor.db, { userId: actor.userId, action: `contracts.${action}`, entityType: "contract_documents", entityId: b.doc.id, metadata: { status: b.doc.status, version: b.doc.version, ...(extra ?? {}) } });

  try {
    if (action === "remind" || action === "resend") {
      const res = action === "remind" ? await remind(actor.db, b.doc.id, sender) : await resend(actor.db, b.doc.id, sender);
      await audit({ delivered: res.delivered });
      return NextResponse.json({ ok: true, delivered: res.delivered });
    }
    if (action === "cancel") {
      if (!canCancelOrArchive(actor, b.doc.created_by)) return forbidden("Only the sender or an admin can cancel this request.");
      await cancelRequest(actor.db, b.doc.id, actor.actorLabel);
      await audit();
      return NextResponse.json({ ok: true });
    }
    if (action === "archive" || action === "restore") {
      if (!canCancelOrArchive(actor, b.doc.created_by)) return forbidden("Only the sender or an admin can archive this document.");
      if (action === "archive" && PENDING.has(b.doc.status)) return bad("Cancel the pending signature request before archiving.", 409);
      await actor.db.from("contract_documents").update({ archived_at: action === "archive" ? new Date().toISOString() : null }).eq("document_key", b.doc.document_key);
      await addEvent(actor.db, b.doc.id, action === "archive" ? "archived" : "restored", actor.actorLabel);
      await audit();
      return NextResponse.json({ ok: true });
    }
    // delete
    if (!actor.isAdmin) return forbidden("Only an admin can delete a contract document.");
    if (PENDING.has(b.doc.status) && b.doc.signature_request_id) {
      await actor.db.from("signature_requests").update({ status: "voided", voided_at: new Date().toISOString() }).eq("id", b.doc.signature_request_id);
    }
    await audit({ template: b.template.name, contact_id: b.doc.contact_id, field_values: b.doc.field_values });
    await actor.db.from("contract_documents").delete().eq("id", b.doc.id);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409);
    return NextResponse.json({ error: errorMessage(err, "Action failed.") }, { status: 500 });
  }
}
