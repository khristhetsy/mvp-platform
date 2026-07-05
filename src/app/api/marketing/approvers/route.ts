import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listApprovers } from "@/lib/marketing/sequences";

export const dynamic = "force-dynamic";

// GET /api/marketing/approvers — eligible sequence approvers (staff + super admins).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    return NextResponse.json(await listApprovers());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
