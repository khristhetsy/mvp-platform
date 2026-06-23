import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { countFolders } from "@/lib/email/inbox";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Use the same inbox semantics as the folder badge (excludes spam/trash) so the
  // sidebar number always matches the inbox's Inbox badge.
  const { inbox } = await countFolders(auth.supabase, auth.profile.id);
  return NextResponse.json({ count: inbox });
}
