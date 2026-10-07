import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSavedReplies, saveSavedReplies } from "@/lib/support/saved-replies";

export const dynamic = "force-dynamic";

/** Support desk saved replies. Staff read and edit. */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ replies: await getSavedReplies() });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { replies?: unknown } | null;
  const saved = await saveSavedReplies(body?.replies, profile.id);
  return saved ? NextResponse.json({ replies: saved }) : NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
}
