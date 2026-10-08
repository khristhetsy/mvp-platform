import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, canSeeContact, forbidden, requireContractsApi } from "@/lib/contracts/access";
import { SendBlockedError } from "@/lib/contracts/service";
import { previewSend, sendTest } from "@/lib/contracts/send-test";
import { RenderFailedError, RenderUnavailableError } from "@/lib/contracts/render-pdf";
import { errorMessage } from "@/lib/contracts/route-helpers";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { hasGmailSendScope } from "@/lib/integrations/gmail-send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Same fields as POST /api/admin/sales/contracts/send, plus what to do. */
const schema = z.object({
  action: z.enum(["preview", "test"]),
  contactId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).min(1).max(6),
  subject: z.string().max(300),
  body: z.string().max(20000),
  emailDraftId: z.string().uuid().nullable().optional(),
  attachPdfs: z.boolean(),
  typedValues: z.record(z.string(), z.string().max(300)).optional(),
  signature: z.boolean().optional(),
  via: z.enum(["gmail", "icapos"]).optional(),
  /** Send as iCFO Capital Global or iCapOS (signature, logo, From name). */
  brand: z.enum(["icfo", "icapos"]).optional(),
  /** Plain email like Gmail (default) or the branded card. */
  style: z.enum(["plain", "branded"]).optional(),
});

/**
 * POST { action: "preview", ...send }  → the cover email as the prospect would get it, and its PDFs
 * POST { action: "test", ...send }     → that email and the real PDFs, sent to you only, "[TEST]" in the subject
 * Neither locks a document, creates a signing link or touches the prospect's record.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid request.");
  const { action, ...input } = parsed.data;
  if (!(await canSeeContact(actor, input.contactId))) return forbidden();
  const senderName = actor.profile.full_name ?? actor.profile.email ?? "iCFO";
  try {
    if (action === "preview") {
      const preview = await previewSend(actor.db, { ...input, senderName, userId: actor.userId });
      return NextResponse.json({ ok: true, ...preview, from: { name: senderName, email: actor.profile.email ?? null, via: input.via ?? "icapos" } });
    }
    if (input.via === "gmail") {
      const google = await getGoogleConnectionStatus(actor.db, actor.userId);
      if (!google.connected || !hasGmailSendScope(google.scopes)) {
        return bad("Your Google account is not connected for sending. Connect Google, or send from iCapOS mail.", 409);
      }
    }
    const result = await sendTest(actor.db, { ...input, senderName, userId: actor.userId, senderEmail: actor.profile.email ?? null, via: input.via ?? "icapos" });
    if (!result.delivered) return NextResponse.json({ error: "The test was not delivered. Check the email settings and try again." }, { status: 502 });
    return NextResponse.json({ ok: true, ...result, sentAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof SendBlockedError) return bad(err.message, 409, err.details);
    if (err instanceof RenderUnavailableError) return NextResponse.json({ error: err.message, code: "render_unavailable" }, { status: 503 });
    if (err instanceof RenderFailedError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: errorMessage(err, action === "test" ? "The test send failed." : "Could not build the preview.") }, { status: 500 });
  }
}
