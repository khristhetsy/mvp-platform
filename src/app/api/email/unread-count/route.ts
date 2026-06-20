import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { countUnreadThreads } from "@/lib/email/inbox";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await countUnreadThreads(auth.supabase, auth.profile.id);
  return NextResponse.json({ count });
}
