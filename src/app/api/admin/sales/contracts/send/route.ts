import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { sendPacket, SendBlockedError } from "@/lib/contracts/service";
import { AnchorNotFoundError } from "@/lib/contracts/signature-anchors";
import { RenderFailedError, RenderUnavailableError } from "@/lib/contracts/render-pdf";
import { writeAuditLog } from "@/lib/data/audit";
import { errorMessage } from "@/lib/contracts/route-helpers";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { hasGmailSendScope } from "@/lib/integrations/gmail-send";
import { scheduleAtFrom, scheduleSend } from "@/lib/scheduled-emails/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  contactId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).min(1).max(6),
  subject: z.string().max(300),
  body: z.string().max(20000),
  emailDraftId: z.string().uuid().nullable(),
  attachPdfs: z.boolean(),
  /** Values typed in the email step for tokens no document or contact provides. */
  typedValues: z.record(z.string(), z.string().max(300)).optional(),
  /** False: send for review only, no signature request. */
  signature: z.boolean().optional(),
  /** Send the cover email from the sender's own Gmail (default: iCapOS mail). */
  via: z.enum(["gmail", "icapos"]).optional(),
});

/** POST — send the selected drafts with one cover email, for signature or (signature: false) for review only. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const raw: unknown = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return bad("Invalid send request.");
  if (!(await canSeeContact(actor, parsed.data.contactId))) return forbidden();
  if (parsed.data.via === "gmail") {
    // Checked before anything is written, so a lapsed Google connection sends nothing.
    const google = await getGoogleConnectionStatus(actor.db, actor.userId);
    if (!google.connected || !hasGmailSendScope(google.scopes)) {
      return bad("Your Google account is not connected for sending. Connect Google, or send from iCapOS mail.", 409);
    }
  }
  if (scheduleAtFrom(raw)) {
    // Schedule send: stored now, sent through this route at that time (scheduled-emails/runner).
    const { data: c } = await actor.db.from("crm_contacts").select("name, email").eq("id", parsed.data.contactId).maybeSingle();
    const who = (c as { name?: string | null; email?: string | null } | null) ?? null;
    return scheduleSend({ kind: "contracts", userId: actor.userId, raw, toLabel: who?.name || who?.email || "Contact", subject: parsed.data.subject, contextKey: parsed.data.contactId });
  }
  try {
    const result = await sendPacket(actor.db, {
      ...parsed.data,
      sender: { id: actor.userId, name: actor.profile.full_name ?? actor.profile.email ?? "iCFO", email: actor.profile.email ?? null, actorLabel: actor.actorLabel },
    });
    for (const docId of parsed.data.documentIds) {
      await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.sent", entityType: "contract_documents", entityId: docId, metadata: { packet_id: result.packetId, delivered: result.delivered, signature: parsed.data.signature !== false, via: parsed.data.via ?? "icapos" } });
    }
    // The send went out: the saved, resumable send for this contact is done.
    await actor.db.from("contract_send_drafts").delete().eq("contact_id", parsed.data.contactId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409, err.details);
    if (err instanceof RenderUnavailableError) return NextResponse.json({ error: err.message, code: "render_unavailable" }, { status: 503 });
    if (err instanceof AnchorNotFoundError || err instanceof RenderFailedError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: errorMessage(err, "Send failed.") }, { status: 500 });
  }
}
