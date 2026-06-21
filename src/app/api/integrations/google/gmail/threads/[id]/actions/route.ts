import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { GMAIL_MODIFY_SCOPE } from "@/lib/integrations/google-oauth";
import { applyGmailAction } from "@/lib/integrations/gmail-write";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["archive", "spam", "notspam", "trash", "untrash", "read", "unread"]) });

/** POST — label/trash action on a Gmail thread (needs gmail.modify). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getGoogleConnectionStatus(auth.supabase, auth.profile.id);
  if (!status.connected || !status.scopes.includes(GMAIL_MODIFY_SCOPE)) {
    return NextResponse.json({ error: "Reconnect Google to allow inbox actions.", needsReconnect: true }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  try {
    await applyGmailAction(auth.profile.id, id, parsed.data.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed." }, { status: 500 });
  }
}
