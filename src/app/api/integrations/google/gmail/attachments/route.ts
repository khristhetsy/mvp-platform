import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { GMAIL_READ_SCOPE } from "@/lib/integrations/google-oauth";
import { fetchGmailAttachment, GmailScopeError } from "@/lib/integrations/gmail-read";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET — stream a single Gmail attachment for download. */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getGoogleConnectionStatus(auth.supabase, auth.profile.id);
  if (!status.connected || !status.scopes.includes(GMAIL_READ_SCOPE)) {
    return NextResponse.json({ error: "Reconnect Google to download attachments." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const messageId = sp.get("messageId");
  const attachmentId = sp.get("attachmentId");
  const filename = sp.get("filename") || "attachment";
  const mimeType = sp.get("mimeType") || "application/octet-stream";
  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: "messageId and attachmentId are required." }, { status: 400 });
  }

  try {
    const bytes = await fetchGmailAttachment(auth.profile.id, messageId, attachmentId);
    // Sanitize the filename for the Content-Disposition header.
    const safeName = filename.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "attachment";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof GmailScopeError) return NextResponse.json({ error: "Reconnect Google to download attachments." }, { status: 403 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Download failed." }, { status: 500 });
  }
}
