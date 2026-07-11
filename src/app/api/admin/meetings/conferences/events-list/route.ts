import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listLinkableEvents } from "@/lib/meetings/registrations";

export const dynamic = "force-dynamic";

// GET — iCFO events a conference can be linked to (for its registration source).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ events: await listLinkableEvents() });
}
