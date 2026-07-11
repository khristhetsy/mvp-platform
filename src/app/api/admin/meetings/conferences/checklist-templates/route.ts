import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listChecklistTemplates } from "@/lib/meetings/checklists";

export const dynamic = "force-dynamic";

// GET — available checklist templates (Conference, Talkshow, ...).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ templates: await listChecklistTemplates() });
}
