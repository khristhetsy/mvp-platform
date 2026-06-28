import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { GMAIL_READ_SCOPE } from "@/lib/integrations/google-oauth";
import { getGmailFolderCounts, listUnreadInboxThreadIds, GmailScopeError } from "@/lib/integrations/gmail-read";
import { getReadThreadIds } from "@/lib/integrations/gmail-read-marks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EMPTY = { inbox: 0, drafts: 0, spam: 0 };

/** GET — per-folder badge counts for the connected Gmail (inbox unread, drafts, spam). */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getGoogleConnectionStatus(auth.supabase, auth.profile.id);
  if (!status.connected || !status.scopes.includes(GMAIL_READ_SCOPE)) {
    return NextResponse.json({ counts: EMPTY });
  }

  try {
    const counts = await getGmailFolderCounts(auth.profile.id);
    // Subtract threads the user has read inside iCapOS from the inbox badge.
    const [unreadIds, readIds] = await Promise.all([
      listUnreadInboxThreadIds(auth.profile.id),
      getReadThreadIds(auth.supabase, auth.profile.id),
    ]);
    if (readIds.size > 0) {
      const stillUnread = unreadIds.filter((id) => !readIds.has(id)).length;
      counts.inbox = Math.min(counts.inbox, stillUnread);
    }
    return NextResponse.json({ counts });
  } catch (err) {
    // Badges are non-critical — never break the Gmail view over a count.
    if (err instanceof GmailScopeError) return NextResponse.json({ counts: EMPTY });
    return NextResponse.json({ counts: EMPTY });
  }
}
