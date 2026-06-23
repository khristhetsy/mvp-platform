import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { countFolders } from "@/lib/email/inbox";

export const dynamic = "force-dynamic";

/** GET — per-folder badge counts (inbox unread, drafts total, spam total). */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const counts = await countFolders(auth.supabase, auth.profile.id);
    return NextResponse.json({ counts });
  } catch {
    // Badges are non-critical — never break the inbox over a count.
    return NextResponse.json({ counts: { inbox: 0, drafts: 0, spam: 0 } });
  }
}
