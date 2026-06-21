import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { GMAIL_READ_SCOPE } from "@/lib/integrations/google-oauth";
import { listGmailThreads, isGmailFolder, GmailScopeError } from "@/lib/integrations/gmail-read";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET — list the user's Gmail INBOX/SENT, with connection/scope status. */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getGoogleConnectionStatus(auth.supabase, auth.profile.id);
  if (!status.connected) return NextResponse.json({ connected: false, needsReadScope: false, threads: [] });
  if (!status.scopes.includes(GMAIL_READ_SCOPE)) {
    return NextResponse.json({ connected: true, needsReadScope: true, email: status.email, threads: [] });
  }

  const folderParam = req.nextUrl.searchParams.get("folder") ?? "inbox";
  const folder = isGmailFolder(folderParam) ? folderParam : "inbox";

  try {
    const threads = await listGmailThreads(auth.profile.id, { folder });
    return NextResponse.json({ connected: true, needsReadScope: false, email: status.email, threads });
  } catch (err) {
    if (err instanceof GmailScopeError) return NextResponse.json({ connected: true, needsReadScope: true, threads: [] });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load Gmail." }, { status: 500 });
  }
}
