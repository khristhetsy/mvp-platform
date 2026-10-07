import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSupportGuides, saveSupportGuides } from "@/lib/support/guides";

export const dynamic = "force-dynamic";

/** Support desk step-by-step guides. Staff read and edit. */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  return NextResponse.json({ guides: await getSupportGuides() });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { guides?: unknown } | null;
  const saved = await saveSupportGuides(body?.guides, profile.id);
  return saved ? NextResponse.json({ guides: saved }) : NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
}
