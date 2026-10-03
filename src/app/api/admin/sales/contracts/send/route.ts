import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { sendPacket, SendBlockedError } from "@/lib/contracts/service";
import { AnchorNotFoundError } from "@/lib/contracts/signature-anchors";
import { RenderFailedError, RenderUnavailableError } from "@/lib/contracts/render-pdf";
import { writeAuditLog } from "@/lib/data/audit";
import { errorMessage } from "@/lib/contracts/route-helpers";

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
});

/** POST — send the selected drafts for signature with one cover email. */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid send request.");
  if (!(await canSeeContact(actor, parsed.data.contactId))) return forbidden();
  try {
    const result = await sendPacket(actor.db, {
      ...parsed.data,
      sender: { id: actor.userId, name: actor.profile.full_name ?? actor.profile.email ?? "iCFO", email: actor.profile.email ?? null, actorLabel: actor.actorLabel },
    });
    for (const docId of parsed.data.documentIds) {
      await writeAuditLog(actor.db, { userId: actor.userId, action: "contracts.sent", entityType: "contract_documents", entityId: docId, metadata: { packet_id: result.packetId, delivered: result.delivered } });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409, err.details);
    if (err instanceof RenderUnavailableError) return NextResponse.json({ error: err.message, code: "render_unavailable" }, { status: 503 });
    if (err instanceof AnchorNotFoundError || err instanceof RenderFailedError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: errorMessage(err, "Send failed.") }, { status: 500 });
  }
}
