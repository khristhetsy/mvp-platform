import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getGmailThread, GmailScopeError } from "@/lib/integrations/gmail-read";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET — full Gmail thread (messages with bodies). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const thread = await getGmailThread(auth.profile.id, id);
    return NextResponse.json({ thread });
  } catch (err) {
    if (err instanceof GmailScopeError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load thread." }, { status: 500 });
  }
}
